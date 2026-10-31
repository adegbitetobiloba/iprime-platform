// Runs the real enrolment controllers against in-memory stand-ins (no database, no network), like approvalFlow.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

let docs, seq, audits, published;
const same = (a, b) => String(a) === String(b);
const match = (d, q) => Object.entries(q).every(([k, v]) => {
  if (v && typeof v === "object" && "$in" in v) return v.$in.includes(d[k]);
  if (v && typeof v === "object" && "$ne" in v) return d[k] !== v.$ne;
  return same(d[k], v);
});
const query = (result) => ({ select() { return this; }, lean() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, then(res, rej) { return Promise.resolve(result).then(res, rej); } });
const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : d);
const setPath = (o, path, val) => { const ks = path.split("."); let c = o; ks.slice(0, -1).forEach((k) => { c[k] = c[k] || {}; c = c[k]; }); c[ks.at(-1)] = val; };
const OPEN = ["draft", "submitted", "under_review", "more_info_required", "approved"];

const FakeEnrolment = {
  create: async (f) => {
    if (docs.some((d) => same(d.userId, f.userId) && same(d.programmeId, f.programmeId) && OPEN.includes(d.status))) { const e = new Error("dup"); e.code = 11000; e.keyPattern = { userId: 1 }; throw e; }
    const d = { _id: `e${++seq}`, ...clone(f), consents: [], reviews: [], subjectsRegistered: [], subjectsRequested: f.subjectsRequested || [] };
    docs.push(d); return { ...clone(d), toObject() { return clone(d); } };
  },
  findOne: (q) => query(clone(docs.find((d) => match(d, q))) || null),
  findById: (id) => query(clone(docs.find((d) => same(d._id, id))) || null),
  exists: async (q) => (docs.some((d) => match(d, q)) ? { _id: 1 } : null),
  find: (q) => query(docs.filter((d) => match(d, q)).map(clone)),
  countDocuments: async (q) => docs.filter((d) => match(d, q)).length,
  findOneAndUpdate: (q, upd) => {
    const d = docs.find((x) => match(x, q));
    if (!d) return query(null);
    for (const [k, v] of Object.entries(upd.$set || {})) setPath(d, k, v);
    for (const [k, v] of Object.entries(upd.$push || {})) d[k].push(...(v.$each || [v]));
    return query(clone(d));
  },
};
const stubs = {
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  "../models/Enrolment": FakeEnrolment,
  "../models/Programme": { findOne: (q) => query(published.includes(String(q._id)) ? { _id: q._id } : null), find: () => query([{ _id: "p1", title: "UTME Prep" }]), findById: () => query({ _id: "p1", title: "UTME Prep" }) },
  "../models/User": { find: () => query([{ _id: "u1", firstName: "Sam", lastName: "S", studentId: "PET-1" }]), findById: () => query({ _id: "u1", firstName: "Sam", lastName: "S", email: "s@x.com" }) },
  "../utils/audit": { audit: async (req, e) => { audits.push(e.event); } },
  "../utils/paging": { parsePaging: () => ({ page: 1, limit: 20, skip: 0 }) },
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /(enrolmentController|adminEnrolmentController)\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};
const student = require("../controllers/enrolmentController");
const admin = require("../controllers/adminEnrolmentController");

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn(req, r); return r; };
const me = (over = {}) => ({ id: "u1", role: "student", ...over });
const staff = { id: "a1", role: "admin" };
beforeEach(() => { docs = []; seq = 0; audits = []; published = ["p1"]; });

const adult = { student: { dob: new Date("2000-01-01"), phone: "08012345678" }, studyMode: "online", session: "evening", subjectsRequested: ["Mathematics"] };
const submitReq = (id, ack = { studentCommitment: true }) => ({ params: { id }, user: me(), body: { acknowledgements: ack } });
async function draft(extra = {}) { const r = await call(student.create, { user: me(), body: { programmeId: "p1", ...adult, ...extra } }); return r.body.enrolment.id; }

// ---------- student: draft ----------
test("a student starts a draft: server reference, status draft, audited", async () => {
  const r = await call(student.create, { user: me(), body: { programmeId: "p1" } });
  assert.equal(r.statusCode, 201);
  assert.match(r.body.enrolment.reference, /^PET-ENR-/);
  assert.equal(r.body.enrolment.status, "draft");
  assert.deepEqual(audits, ["enrolment.draft_created"]);
});
test("a programme that is not published cannot be applied to", async () => {
  const r = await call(student.create, { user: me(), body: { programmeId: "p9" } });
  assert.equal(r.statusCode, 404);
});
test("a second open application for the same programme is refused with the existing id", async () => {
  const id = await draft();
  const r = await call(student.create, { user: me(), body: { programmeId: "p1" } });
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.id, id);
});
test("the typed fee is stored as integer kobo; an invalid amount is refused", async () => {
  const ok = await call(student.create, { user: me(), body: { programmeId: "p1", payment: { agreedFee: "18,000", plan: "monthly" } } });
  assert.equal(ok.body.enrolment.payment.agreedFeeMinor, 1800000);
  assert.equal(ok.body.enrolment.payment.currency, "NGN");
  const bad = await call(student.create, { user: me({ id: "u2" }), body: { programmeId: "p1", payment: { agreedFee: "abc" } } });
  assert.equal(bad.statusCode, 400);
});

// ---------- student: save / resume ----------
test("saving one field keeps the others (save and resume)", async () => {
  const id = await draft();
  const r = await call(student.save, { params: { id }, user: me(), body: { student: { preferredName: "Sammy" } } });
  assert.equal(r.body.enrolment.student.preferredName, "Sammy");
  assert.equal(r.body.enrolment.student.phone, "08012345678");
});
test("a student cannot write status, office or registered subjects, even if they are sent", async () => {
  const id = await draft();
  await call(student.save, { params: { id }, user: me(), body: { studyMode: "physical", status: "approved", subjectsRegistered: ["Physics"], office: { feeApprovedMinor: 1 }, reviews: [{ action: "approved" }] } });
  const d = docs[0];
  assert.equal(d.status, "draft");
  assert.deepEqual(d.subjectsRegistered, []);
  assert.equal(d.office, undefined);
  assert.equal(d.studyMode, "physical");
});
test("another student cannot read or edit it: 404, not 403", async () => {
  const id = await draft();
  assert.equal((await call(student.getOne, { params: { id }, user: me({ id: "u2" }) })).statusCode, 404);
  assert.equal((await call(student.save, { params: { id }, user: me({ id: "u2" }), body: { studyMode: "physical" } })).statusCode, 404);
});
test("a student never receives the staff-only office block", async () => {
  const id = await draft();
  docs[0].office = { feeApprovedMinor: 999 };
  const r = await call(student.mine, { user: me() });
  assert.equal(r.body.enrolments[0].office, undefined);
});

// ---------- student: submit ----------
test("an incomplete application is refused with a clear reason and stays a draft", async () => {
  const r0 = await call(student.create, { user: me(), body: { programmeId: "p1" } });
  const r = await call(student.submit, submitReq(r0.body.enrolment.id));
  assert.equal(r.statusCode, 400);
  assert.ok(r.body.problems.length >= 4);
  assert.equal(docs[0].status, "draft");
});
test("a complete adult application submits and records the student commitment with a policy version", async () => {
  const id = await draft();
  const r = await call(student.submit, submitReq(id));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.enrolment.status, "submitted");
  assert.equal(r.body.enrolment.consents.length, 1);
  assert.equal(r.body.enrolment.consents[0].kind, "student_commitment");
  assert.ok(r.body.enrolment.consents[0].policyVersion && r.body.enrolment.consents[0].textHash);
  assert.ok(audits.includes("enrolment.submitted"));
});
test("submitting without accepting the commitment is refused", async () => {
  const id = await draft();
  const r = await call(student.submit, submitReq(id, { studentCommitment: false }));
  assert.equal(r.statusCode, 400);
});
test("a minor needs guardian details and guardian consent", async () => {
  const id = await draft({ student: { dob: new Date("2012-01-01"), phone: "08012345678" } });
  assert.equal((await call(student.submit, submitReq(id))).statusCode, 400);
  await call(student.save, { params: { id }, user: me(), body: { guardian: { name: "Mrs S", relationship: "Mother", phone: "08099999999" } } });
  assert.equal((await call(student.submit, submitReq(id))).statusCode, 400); // details are in, consent still missing
  const ok = await call(student.submit, submitReq(id, { studentCommitment: true, guardian: { signerName: "Mrs S", relationship: "Mother" } }));
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.body.enrolment.consents.map((c) => c.kind), ["student_commitment", "guardian_consent"]);
});
test("submitting twice does not create a second submission or duplicate consents", async () => {
  const id = await draft();
  await call(student.submit, submitReq(id));
  const again = await call(student.submit, submitReq(id));
  assert.equal(again.statusCode, 409);
  assert.equal(docs[0].consents.length, 1);
  assert.equal(audits.filter((e) => e === "enrolment.submitted").length, 1);
});
test("once submitted the student can no longer edit it", async () => {
  const id = await draft();
  await call(student.submit, submitReq(id));
  const r = await call(student.save, { params: { id }, user: me(), body: { studyMode: "physical" } });
  assert.equal(r.statusCode, 409);
  assert.equal(docs[0].studyMode, "online");
});

// ---------- admin review ----------
const submitted = async () => { const id = await draft(); await call(student.submit, submitReq(id)); audits.length = 0; return id; };
const areq = (id, body = {}) => ({ params: { id }, user: staff, body });

test("drafts are invisible to staff", async () => {
  const id = await draft();
  assert.equal((await call(admin.get, areq(id))).statusCode, 404);
  assert.equal((await call(admin.list, { user: staff, query: {} })).body.total, 0);
});
test("staff list shows submitted applications without medical or guardian details", async () => {
  await submitted();
  const r = await call(admin.list, { user: staff, query: {} });
  assert.equal(r.body.total, 1);
  assert.equal(r.body.enrolments[0].health, undefined);
  assert.equal(r.body.enrolments[0].guardian, undefined);
  assert.equal(r.body.enrolments[0].applicant.firstName, "Sam");
  assert.equal(r.body.enrolments[0].programmeTitle, "UTME Prep");
});
test("opening an application is audited", async () => {
  const id = await submitted();
  const r = await call(admin.get, areq(id));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.enrolment.programmeTitle, "UTME Prep");
  assert.deepEqual(audits, ["enrolment.viewed"]);
});
test("approval needs the registered subjects confirmed first", async () => {
  const id = await submitted();
  assert.equal((await call(admin.approve, areq(id))).statusCode, 400);
  await call(admin.updateOffice, areq(id, { subjectsRegistered: ["Mathematics"] }));
  const r = await call(admin.approve, areq(id));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.enrolment.status, "approved");
  assert.equal(r.body.enrolment.reviews.at(-1).by, "a1");
  assert.ok(audits.includes("enrolment.approved"));
});
test("rejecting or asking for more information needs a reason", async () => {
  const id = await submitted();
  assert.equal((await call(admin.reject, areq(id))).statusCode, 400);
  assert.equal((await call(admin.requestInfo, areq(id, { note: "  " }))).statusCode, 400);
  assert.equal(docs[0].status, "submitted");
});
test("asking for more information lets the student edit and resubmit", async () => {
  const id = await submitted();
  await call(admin.requestInfo, areq(id, { note: "Add guardian phone" }));
  assert.equal((await call(student.save, { params: { id }, user: me(), body: { studyMode: "physical" } })).statusCode, 200);
  assert.equal((await call(student.submit, submitReq(id))).statusCode, 200);
  assert.equal(docs[0].status, "submitted");
});
test("a rejected application stays rejected, keeps its history, and cannot be approved", async () => {
  const id = await submitted();
  await call(admin.reject, areq(id, { note: "Not eligible" }));
  const r = await call(admin.approve, areq(id));
  assert.equal(r.statusCode, 409);
  assert.equal(docs[0].status, "rejected");
  assert.equal(docs[0].reviews[0].note, "Not eligible");
});
test("approving twice is refused the second time and audited once", async () => {
  const id = await submitted();
  await call(admin.updateOffice, areq(id, { subjectsRegistered: ["Mathematics"] }));
  await call(admin.approve, areq(id));
  assert.equal((await call(admin.approve, areq(id))).statusCode, 409);
  assert.equal(audits.filter((e) => e === "enrolment.approved").length, 1);
});

// ---------- office-only fields ----------
test("the approved fee is stored in kobo and never overwrites what the student typed", async () => {
  const id = await draft({ payment: { agreedFee: "15000", plan: "weekly" } });
  await call(student.submit, submitReq(id));
  const r = await call(admin.updateOffice, areq(id, { feeApproved: "18,000" }));
  assert.equal(r.body.enrolment.office.feeApprovedMinor, 1800000);
  assert.equal(r.body.enrolment.payment.agreedFeeMinor, 1500000);
  assert.equal(r.body.enrolment.office.registeredBy, "a1");
});
test("an invalid or zero approved fee is refused", async () => {
  const id = await submitted();
  for (const bad of ["abc", "0", "-5", "1.234"]) assert.equal((await call(admin.updateOffice, areq(id, { feeApproved: bad }))).statusCode, 400);
});
test("office fields cannot be changed on a closed application", async () => {
  const id = await submitted();
  await call(admin.reject, areq(id, { note: "No" }));
  assert.equal((await call(admin.updateOffice, areq(id, { subjectsRegistered: ["Physics"] }))).statusCode, 409);
});
test("office changes record before and after in the audit trail", async () => {
  const id = await submitted();
  await call(admin.updateOffice, areq(id, { subjectsRegistered: ["Physics"] }));
  assert.deepEqual(audits, ["enrolment.office_updated"]);
});

test("summary counts real applications per status and ignores drafts", async () => {
  await call(student.create, { user: me({ id: "u8" }), body: { programmeId: "p1" } }); // a draft by another student: must not be counted
  const id = await submitted();
  await call(admin.reject, areq(id, { note: "No" }));
  await submitted_other();
  const r = await call(admin.summary, { user: staff });
  assert.equal(r.body.counts.submitted, 1);
  assert.equal(r.body.counts.rejected, 1);
  assert.equal(r.body.counts.approved, 0);
  assert.equal(r.body.counts.draft, undefined);
  assert.equal(r.body.total, 2);
});
async function submitted_other() {
  const body = { programmeId: "p1", ...adult };
  const c = await call(student.create, { user: me({ id: "u7" }), body });
  await call(student.submit, { params: { id: c.body.enrolment.id }, user: me({ id: "u7" }), body: { acknowledgements: { studentCommitment: true } } });
}
