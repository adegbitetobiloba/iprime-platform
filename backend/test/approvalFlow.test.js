// Runs the real auth and admin controllers against in-memory stand-ins (no database, no network).
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
delete process.env.REQUIRE_STUDENT_APPROVAL;

let users, seq, sent, otpRecord;
class FakeUser {
  constructor(f) { Object.assign(this, f); this._id = f._id || `u${++seq}`; }
  async save() { return this; }
  toObject() { return { ...this }; }
  static async findOne(q) { return users.find((u) => Object.entries(q).every(([k, v]) => u[k] === v)) || null; }
  static async findById(id) { return users.find((u) => u._id === id) || null; }
  static async findOneAndUpdate(q, upd) { const u = await FakeUser.findOne(q); if (u) Object.assign(u, upd); return u; }
  static async create(f) { const u = new FakeUser(f); users.push(u); return u; }
}
const stubs = {
  bcryptjs: { hashSync: (x) => `h:${x}`, hash: async (x) => `h:${x}`, compare: async (p, h) => h === `h:${p}` },
  "../models/User": FakeUser,
  "../models/Otp": { findOne: () => ({ sort: async () => otpRecord }), deleteMany: async () => {} },
  "../models/RevokedToken": { updateOne: async () => {} },
  "../utils/session": { issueSession: (u) => `session-for-${u._id}` },
  "../utils/studentId": { ensureStudentId: async (u) => u },
  "../utils/adminAllowlist": { applyAdminAllowlist: async (u) => u },
  "../utils/otpService": { issueOtp: async () => {} },
  "../utils/publicUser": (u) => ({ id: u._id, email: u.email, role: u.role, approval: u.approval }),
  "../utils/notify": {
    notifyAdminsNewStudent: async (u) => { sent.push(["admins", u.email]); },
    notifyApproved: async (u) => { sent.push(["approved", u.email]); },
    notifyRejected: async (u, note) => { sent.push(["rejected", u.email, note]); },
  },
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  "../models/Exam": {}, "../models/Attempt": {}, "../models/Programme": {},
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /controllers[\\/](authController|adminUserController)\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};
const auth = require("../controllers/authController");
const admin = require("../controllers/adminUserController");

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, body, extra = {}) => { const r = res(); await fn({ body, ...extra }, r); return r; };
beforeEach(() => { users = []; seq = 0; sent = []; otpRecord = null; });

const student = (over = {}) => new FakeUser({ email: "s@x.com", role: "student", isVerified: true, password: "h:pw12345678", firstName: "Sam", lastName: "S", ...over });

// ---------- logging in ----------
test("a NEW student (pending) with the right password gets NO token and a clear 'waiting for approval' answer", async () => {
  users.push(student({ approval: "pending" }));
  const r = await call(auth.login, { email: "s@x.com", password: "pw12345678" });
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.code, "PENDING_APPROVAL");
  assert.equal(r.body.token, undefined);
});
test("a pending student with the WRONG password gets the ordinary 'invalid' answer (their status is not revealed)", async () => {
  users.push(student({ approval: "pending" }));
  const r = await call(auth.login, { email: "s@x.com", password: "nope" });
  assert.equal(r.statusCode, 400);
  assert.equal(r.body.code, undefined);
});
test("a rejected student is told so, and gets no token", async () => {
  users.push(student({ approval: "rejected" }));
  const r = await call(auth.login, { email: "s@x.com", password: "pw12345678" });
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.code, "ACCOUNT_REJECTED");
});
test("an approved student logs in normally", async () => {
  users.push(student({ approval: "approved" }));
  const r = await call(auth.login, { email: "s@x.com", password: "pw12345678" });
  assert.ok(r.body.token);
});
test("EXISTING students (no approval value) are NOT locked out", async () => {
  users.push(student()); // created before approval existed
  const r = await call(auth.login, { email: "s@x.com", password: "pw12345678" });
  assert.ok(r.body.token);
});
test("an unverified email is still asked to verify first", async () => {
  users.push(student({ approval: "pending", isVerified: false }));
  const r = await call(auth.login, { email: "s@x.com", password: "pw12345678" });
  assert.equal(r.body.code, "NOT_VERIFIED");
});

// ---------- verifying the email ----------
test("verifying the email tells a new student what happens next, and alerts the administrators", async () => {
  users.push(student({ approval: "pending", isVerified: false }));
  otpRecord = { otp: "123456", attempts: 0, save: async () => {} };
  const r = await call(auth.verifyOtp, { email: "s@x.com", otp: "123456" });
  assert.equal(r.body.approval, "pending");
  assert.match(r.body.message, /administrator must approve/);
  assert.deepEqual(sent, [["admins", "s@x.com"]]);
});
test("verifying a parent's email needs no approval and alerts nobody", async () => {
  users.push(student({ role: "parent", approval: "approved", isVerified: false }));
  otpRecord = { otp: "123456", attempts: 0, save: async () => {} };
  const r = await call(auth.verifyOtp, { email: "s@x.com", otp: "123456" });
  assert.equal(r.body.approval, "approved");
  assert.deepEqual(sent, []);
});

// ---------- registering ----------
test("a new student account is created as pending; a parent is created approved", async () => {
  await call(auth.register, { email: "n@x.com", password: "longenough1", firstName: "N", lastName: "N", role: "student", phone: "08012345678", state: "Lagos" });
  await call(auth.register, { email: "p@x.com", password: "longenough1", firstName: "P", lastName: "P", role: "parent", phone: "08012345678", state: "Lagos" });
  assert.equal(users.find((u) => u.email === "n@x.com").approval, "pending");
  assert.equal(users.find((u) => u.email === "p@x.com").approval, "approved");
});

// ---------- the administrator's decision ----------
const adminReq = (id, body) => ({ params: { id }, body, user: { id: "admin1", role: "admin" } });
test("an administrator approves a student: status changes, who/when is recorded, the student is emailed", async () => {
  users.push(student({ _id: "st1", approval: "pending" }));
  const r = res(); await admin.reviewApproval(adminReq("st1", { status: "approved" }), r);
  assert.equal(r.body.account.approval, "approved");
  assert.equal(users[0].approvalReview.by, "admin1");
  assert.ok(users[0].approvalReview.at instanceof Date);
  assert.deepEqual(sent, [["approved", "s@x.com"]]);
});
test("declining records the note and emails the student", async () => {
  users.push(student({ _id: "st1", approval: "pending" }));
  const r = res(); await admin.reviewApproval(adminReq("st1", { status: "rejected", note: "Not on our list" }), r);
  assert.equal(users[0].approval, "rejected");
  assert.deepEqual(sent, [["rejected", "s@x.com", "Not on our list"]]);
});
test("a declined student can be approved later (changing your mind is allowed)", async () => {
  users.push(student({ _id: "st1", approval: "rejected" }));
  const r = res(); await admin.reviewApproval(adminReq("st1", { status: "approved" }), r);
  assert.equal(users[0].approval, "approved");
});
test("an administrator cannot change their own approval, and administrator accounts cannot be targeted", async () => {
  users.push(new FakeUser({ _id: "admin1", email: "a@x.com", role: "admin", approval: "approved" }));
  users.push(new FakeUser({ _id: "admin2", email: "b@x.com", role: "admin", approval: "approved" }));
  let r = res(); await admin.reviewApproval(adminReq("admin1", { status: "rejected" }), r);
  assert.equal(r.statusCode, 400);
  r = res(); await admin.reviewApproval(adminReq("admin2", { status: "rejected" }), r);
  assert.equal(r.statusCode, 404);
  assert.equal(users[1].approval, "approved");
});
test("an invalid status is refused and nothing changes", async () => {
  users.push(student({ _id: "st1", approval: "pending" }));
  const r = res(); await admin.reviewApproval(adminReq("st1", { status: "banana" }), r);
  assert.equal(r.statusCode, 400);
  assert.equal(users[0].approval, "pending");
});
test("an unknown account is a clean 404", async () => {
  const r = res(); await admin.reviewApproval(adminReq("nope", { status: "approved" }), r);
  assert.equal(r.statusCode, 404);
});
