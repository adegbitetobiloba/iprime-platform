// Exercises the real googleController against in-memory stand-ins for the database, Google and email,
// so the account-linking rules are checked without any network or database.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.GOOGLE_CLIENT_ID = "client-1.apps.googleusercontent.com";

// ---- in-memory User model ----
let users, seq;
class FakeUser {
  constructor(f) { Object.assign(this, f); this._id = f._id || `u${++seq}`; }
  async save() { return this; }
  static async findOne(q) { return users.find((u) => Object.entries(q).every(([k, v]) => u[k] === v)) || null; }
  static async findById(id) { return users.find((u) => u._id === id) || null; }
  static async create(f) {
    if (users.some((u) => (f.email && u.email === f.email) || (f.googleId && u.googleId === f.googleId))) { const e = new Error("dup"); e.code = 11000; throw e; }
    const u = new FakeUser(f); users.push(u); return u;
  }
}
// ---- stand-ins ----
let googlePayload, otpStore;
const stubs = {
  bcryptjs: { hashSync: (x) => `h:${x}`, compare: async (p, h) => h === `h:${p}` },
  "../models/User": FakeUser,
  "../utils/publicUser": (u) => ({ id: u._id, email: u.email, role: u.role, alumniStatus: u.alumniStatus }),
  "../utils/session": { issueSession: (u) => `session-for-${u._id}` },
  "../utils/studentId": { ensureStudentId: async (u) => u },
  "../utils/adminAllowlist": { applyAdminAllowlist: async (u) => u },
  "../utils/googleAuth": { createNonceStore: require("../utils/googleAuth").createNonceStore, verifyGoogleIdToken: async () => googlePayload },
  "../utils/otpService": {
    COOLDOWN_MS: 60000,
    issueOtp: async (email) => { otpStore[email] = "123456"; },
    consumeOtp: async (email, code) => { const ok = otpStore[email] === code; if (ok) delete otpStore[email]; return ok; },
    msSinceLastOtp: async () => Infinity,
  },
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /controllers[\\/]googleController\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};
const g = require("../controllers/googleController");

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, set() { return this; } });
const nonce = () => { const r = res(); g.nonce({}, r); return r.body.nonce; };
const google = (over = {}) => ({ sub: "g-1", email: "ada@gmail.com", email_verified: true, given_name: "Ada", family_name: "Obi", nonce: nonce(), ...over });
async function call(fn, body, extra = {}) { const r = res(); await fn({ body, ...extra }, r); return r; }

beforeEach(() => { users = []; seq = 0; otpStore = {}; });

test("a brand-new Google user is asked which account type to open (nothing is created or assumed)", async () => {
  googlePayload = google();
  const r = await call(g.signIn, { credential: "x".repeat(30) });
  assert.equal(r.body.status, "onboarding");
  assert.equal(users.length, 0);
  assert.equal(r.body.profile.email, "ada@gmail.com");
});

test("finishing onboarding creates the account the person chose, with a verified email", async () => {
  googlePayload = google();
  const first = await call(g.signIn, { credential: "x".repeat(30) });
  const r = await call(g.complete, { setupToken: first.body.setupToken, role: "alumni", graduationYear: 2019, lastClass: "SS 3" });
  assert.equal(r.body.status, "signed_in");
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "alumni");
  assert.equal(users[0].alumniStatus, "unverified");   // a claim, not yet confirmed
  assert.equal(users[0].isVerified, true);
  assert.equal(users[0].password, undefined);
});

test("a setup step cannot be completed with a forged or wrong-purpose token", async () => {
  const r = await call(g.complete, { setupToken: "a".repeat(40) + "." + "b".repeat(40), role: "student" });
  assert.equal(r.statusCode, 401);
  assert.equal(users.length, 0);
});

test("choosing the type up front (sign-up page) creates the account directly", async () => {
  googlePayload = google();
  const r = await call(g.signIn, { credential: "x".repeat(30), role: "parent" });
  assert.equal(r.body.status, "signed_in");
  assert.equal(users[0].role, "parent");
});

test("a returning Google user signs in to the SAME account (no duplicate)", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", googleId: "g-1", role: "student", isVerified: true }));
  googlePayload = google();
  const r = await call(g.signIn, { credential: "x".repeat(30) });
  assert.equal(r.body.status, "signed_in");
  assert.equal(users.length, 1);
});

test("same email as a password account: NOT signed in, NOT merged; ownership must be proven", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: true, password: "h:secret", studentId: "PET-1" }));
  googlePayload = google();
  const r = await call(g.signIn, { credential: "x".repeat(30) });
  assert.equal(r.body.status, "link_required");
  assert.equal(r.body.token, undefined);
  assert.deepEqual(r.body.methods, ["password", "code"]);
  assert.equal(users[0].googleId, undefined);
});

test("linking with the right password works and keeps the account, role and student ID", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: true, password: "h:secret", studentId: "PET-1" }));
  googlePayload = google();
  const need = await call(g.signIn, { credential: "x".repeat(30) });
  const r = await call(g.linkWithPassword, { linkToken: need.body.linkToken, password: "secret" });
  assert.equal(r.body.status, "signed_in");
  assert.equal(users.length, 1);
  assert.equal(users[0].googleId, "g-1");
  assert.equal(users[0].role, "student");
  assert.equal(users[0].studentId, "PET-1");
  assert.equal(users[0].password, "h:secret"); // password login still works
});

test("linking with the wrong password is refused and links nothing", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: true, password: "h:secret" }));
  googlePayload = google();
  const need = await call(g.signIn, { credential: "x".repeat(30) });
  const r = await call(g.linkWithPassword, { linkToken: need.body.linkToken, password: "guess" });
  assert.equal(r.statusCode, 401);
  assert.equal(users[0].googleId, undefined);
});

test("a link token cannot be used by someone else to link a different Google account", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: true, password: "h:secret" }));
  users.push(new FakeUser({ email: "eve@gmail.com", googleId: "g-eve", role: "student", isVerified: true }));
  googlePayload = google({ sub: "g-eve" });            // Eve's real Google account, but Ada's email claimed
  googlePayload.email = "ada@gmail.com";
  const need = await call(g.signIn, { credential: "x".repeat(30) });
  // Eve's Google id is already linked elsewhere, so linking Ada's account to it must be refused
  const r = await call(g.linkWithPassword, { linkToken: need.body.linkToken, password: "secret" });
  assert.notEqual(r.body.status, "signed_in");
  assert.equal(users[0].googleId, undefined);
});

test("linking by emailed code works, and a wrong code is refused", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: true, password: "h:secret" }));
  googlePayload = google();
  const need = await call(g.signIn, { credential: "x".repeat(30) });
  const sent = await call(g.sendLinkCode, { linkToken: need.body.linkToken });
  assert.ok(sent.body.message);
  const bad = await call(g.confirmLinkCode, { linkToken: need.body.linkToken, code: "000000" });
  assert.equal(bad.statusCode, 401);
  const ok = await call(g.confirmLinkCode, { linkToken: need.body.linkToken, code: "123456" });
  assert.equal(ok.body.status, "signed_in");
  assert.equal(users[0].googleId, "g-1");
});

test("SQUATTER CASE: an unverified account with someone else's password offers only the emailed code, and linking removes that password", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", role: "student", isVerified: false, password: "h:attacker-pass" }));
  googlePayload = google();
  const need = await call(g.signIn, { credential: "x".repeat(30) });
  assert.deepEqual(need.body.methods, ["code"]);
  const viaPassword = await call(g.linkWithPassword, { linkToken: need.body.linkToken, password: "attacker-pass" });
  assert.equal(viaPassword.statusCode, 401);           // the squatter's password is not accepted as proof
  await call(g.sendLinkCode, { linkToken: need.body.linkToken });
  const ok = await call(g.confirmLinkCode, { linkToken: need.body.linkToken, code: "123456" });
  assert.equal(ok.body.status, "signed_in");
  assert.equal(users[0].isVerified, true);
  assert.equal(users[0].password, undefined);          // attacker's password is gone
});

test("an email already tied to a DIFFERENT Google account is a conflict, never overwritten", async () => {
  users.push(new FakeUser({ email: "ada@gmail.com", googleId: "someone-else", role: "student", isVerified: true }));
  googlePayload = google({ sub: "g-new" });
  const r = await call(g.signIn, { credential: "x".repeat(30) });
  assert.equal(r.statusCode, 409);
  assert.equal(users[0].googleId, "someone-else");
});

test("a Google token reused (same nonce twice) is refused the second time", async () => {
  const n = nonce();
  googlePayload = google({ nonce: n });
  await call(g.signIn, { credential: "x".repeat(30) });
  googlePayload = google({ nonce: n });
  const r = await call(g.signIn, { credential: "x".repeat(30) });
  assert.equal(r.statusCode, 401);
});

test("a link token is useless after it expires or when tampered with", async () => {
  const r = await call(g.linkWithPassword, { linkToken: "x".repeat(40), password: "secret" });
  assert.equal(r.statusCode, 401);
});
