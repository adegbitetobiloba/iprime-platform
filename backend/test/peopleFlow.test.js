// Real controllers for people records, payments, verification, deletion and the student's enrolment info,
// run against in-memory stand-ins (no database, no network).
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./helpers/fakes");

let db, audits, notified;
const tables = () => ({ users: [], access: [], enrolments: [], attendance: [], convs: [], messages: [], files: [], otps: [], settings: [] });
const M = (name, opts) => new Proxy({}, { get: (_, k) => F.model(db[name], opts)[k] }); // always reads the current test's tables

const stubs = {
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  bcryptjs: { hash: async () => "UNUSABLE-HASH" },
  "../models/User": M("users", { prefix: "u" }), "../models/StudentAccess": M("access", { prefix: "a" }), "../models/Enrolment": M("enrolments", { prefix: "e" }),
  "../models/Attendance": M("attendance", { prefix: "t" }), "../models/Conversation": M("convs", { prefix: "c" }), "../models/Message": M("messages", { prefix: "m" }),
  "../models/MessageFile": M("files", { prefix: "f" }), "../models/Otp": M("otps", { prefix: "o" }), "../models/SiteSetting": M("settings", { prefix: "s" }),
  "../utils/paging": F.paging, "../utils/audit": { audit: async (req, e) => { audits.push(e); } }, "../utils/accessNotify": { notifyPaymentConfirmed: async (u) => { notified.push(u.email); } },
};
F.install(stubs, /(adminPeopleController|studentAccessController|adminSettingsController)\.js$/);
const people = require("../controllers/adminPeopleController");
const access = require("../controllers/studentAccessController");
const settings = require("../controllers/adminSettingsController");
const { call } = F;

const admin = { id: "a-admin", role: "admin" };
const as = (id) => ({ id, role: "student" });
beforeEach(() => {
  F.resetIds(); audits = []; notified = [];
  db = tables();
  db.users.push(
    { _id: "s1", role: "student", firstName: "Ada", lastName: "Obi", email: "ada@x.com", phone: "0801", state: "Oyo", studentId: "PET-ADA1", isVerified: true, approval: "approved", dob: new Date("2000-01-01") },
    { _id: "s2", role: "student", firstName: "Bayo", lastName: "Eze", email: "bayo@x.com", studentId: "PET-BAY2", isVerified: true, approval: "approved", dob: new Date("2012-05-05") },
    { _id: "p1", role: "parent", firstName: "Pat", lastName: "Parent", email: "pat@x.com", isVerified: true },
    { _id: "a-admin", role: "admin", firstName: "Chidi", lastName: "Admin", email: "chidi@x.com", isVerified: true },
    { _id: "gone", role: "student", firstName: "Deleted", lastName: "Account", email: "deleted-gone@deleted.invalid" },
  );
});
const rec = (id) => call(people.record, { user: admin, params: { id } });
const pay = (id, body = {}) => call(people.addPayment, { user: admin, params: { id }, body: { amount: "18000", method: "bank_transfer", ...body } });

// ---------- finding people ----------
test("the people list hides deleted accounts and supports search and role filters", async () => {
  const all = await call(people.list, { user: admin, query: {} });
  assert.ok(!all.body.people.some((p) => p.email.endsWith("@deleted.invalid")));
  assert.equal((await call(people.list, { user: admin, query: { search: "ada" } })).body.people.length, 1);
  assert.equal((await call(people.list, { user: admin, query: { search: "PET-BAY" } })).body.people[0].name, "Bayo Eze");
  assert.deepEqual((await call(people.list, { user: admin, query: { role: "parent" } })).body.people.map((p) => p.name), ["Pat Parent"]);
});
test("a person's record gathers payment, access, verification, enrolment and messaging on one screen", async () => {
  const r = await rec("s1");
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.person.name, "Ada Obi");
  assert.equal(r.body.access.paymentStatus, "awaiting");
  assert.equal(r.body.access.features.enrolmentForm, false);
  assert.equal(r.body.access.verification.status, "unverified");
  assert.equal(r.body.enrolment, null);
  assert.equal(r.body.messaging.blocked, false);
});
test("unknown and deleted people are 'not found'", async () => {
  assert.equal((await rec("nobody")).statusCode, 404);
  assert.equal((await rec("gone")).statusCode, 404);
});

// ---------- payment confirmation and the student form ----------
test("confirming a payment records it in kobo, opens the student form, audits it and emails the student", async () => {
  const r = await pay("s1", { reference: "TRF-1001", receivedOn: "2026-11-01" });
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.paymentStatus, "confirmed");
  assert.equal(r.body.payments[0].amountMinor, 1800000);
  assert.equal(r.body.features.enrolmentForm, true);
  assert.equal(db.access[0].features.enrolmentForm, true);
  assert.equal(db.access[0].payments[0].confirmedBy, "a-admin");
  assert.deepEqual(audits.map((a) => a.event), ["payment.confirmed"]);
  assert.deepEqual(notified, ["ada@x.com"]);
  assert.ok(!JSON.stringify(audits[0]).includes("TRF-1001")); // the audit entry holds no reference
});
test("bad amounts are refused and nothing is recorded", async () => {
  for (const amount of ["", "abc", "-5", "0", "1.234"]) assert.equal((await pay("s1", { amount })).statusCode, 400);
  assert.equal(db.access.length, 0);
});
test("the same transfer reference cannot be counted twice, even for another student; a voided one can be reused", async () => {
  await pay("s1", { reference: "TRF-9" });
  assert.equal((await pay("s2", { reference: "TRF-9" })).statusCode, 409);
  assert.equal((await pay("s2", { reference: "TRF-9", method: "cash" })).statusCode, 201); // different method: different record
  const id = db.access.find((a) => a.userId === "s1").payments[0]._id;
  await call(people.voidPayment, { user: admin, params: { id: "s1", entryId: id }, body: { reason: "Bank reversed the transfer" } });
  assert.equal((await pay("s2", { reference: "TRF-9", method: "bank_transfer" })).statusCode, 201);
});
test("payments and the form can only be handled for students", async () => {
  assert.equal((await pay("p1")).statusCode, 400);
  assert.equal((await call(people.setFeatures, { user: admin, params: { id: "p1" }, body: { enrolmentForm: true, reason: "because" } })).statusCode, 400);
});
test("voiding the only payment closes the form again; voiding one of two keeps it open", async () => {
  await pay("s1", { reference: "A" });
  const first = db.access[0].payments[0]._id;
  const closed = await call(people.voidPayment, { user: admin, params: { id: "s1", entryId: first }, body: { reason: "Entered for the wrong student" } });
  assert.equal(closed.body.formClosed, true);
  assert.equal(db.access[0].features.enrolmentForm, false);
  assert.equal((await rec("s1")).body.access.paymentStatus, "awaiting");
  await pay("s1", { reference: "B" }); await pay("s1", { reference: "C" });
  const live = db.access[0].payments.filter((p) => !p.voidedAt);
  const kept = await call(people.voidPayment, { user: admin, params: { id: "s1", entryId: live[0]._id }, body: { reason: "Duplicate entry" } });
  assert.equal(kept.body.formClosed, false);
  assert.equal(db.access[0].features.enrolmentForm, true);
});
test("a payment cannot be voided twice or without a stored match", async () => {
  await pay("s1", { reference: "A" });
  const id = db.access[0].payments[0]._id;
  await call(people.voidPayment, { user: admin, params: { id: "s1", entryId: id }, body: { reason: "Mistake in entry" } });
  assert.equal((await call(people.voidPayment, { user: admin, params: { id: "s1", entryId: id }, body: { reason: "Mistake in entry" } })).statusCode, 404);
  assert.equal(db.access[0].payments[0].voidReason, "Mistake in entry"); // history kept, not deleted
});
test("opening the form without a payment needs a reason, which is recorded; closing it needs none", async () => {
  const no = await call(people.setFeatures, { user: admin, params: { id: "s1" }, body: { enrolmentForm: true } });
  assert.equal(no.statusCode, 400); assert.equal(no.body.code, "REASON_REQUIRED");
  const yes = await call(people.setFeatures, { user: admin, params: { id: "s1" }, body: { enrolmentForm: true, reason: "Scholarship student, fee waived" } });
  assert.equal(yes.statusCode, 200);
  assert.equal(db.access[0].unlockNote.reason, "Scholarship student, fee waived");
  assert.equal(audits.at(-1).meta.withoutPayment, true);
  assert.equal((await call(people.setFeatures, { user: admin, params: { id: "s1" }, body: { enrolmentForm: false } })).statusCode, 200);
  assert.equal(db.access[0].features.enrolmentForm, false);
});

// ---------- what the student sees ----------
test("the student sees the notice and their status, never amounts or references", async () => {
  const before = await call(access.info, { user: as("s1") });
  assert.equal(before.body.payment.status, "awaiting"); assert.equal(before.body.form.unlocked, false);
  assert.match(before.body.notice, /office must confirm your payment/);
  await pay("s1", { reference: "SECRET-REF" });
  const after = await call(access.info, { user: as("s1") });
  assert.equal(after.body.payment.status, "confirmed"); assert.equal(after.body.form.unlocked, true);
  assert.ok(!JSON.stringify(after.body).includes("SECRET-REF")); assert.ok(!JSON.stringify(after.body).includes("1800000"));
});
test("the office can write its own notice; clearing it restores the default; the audit never holds the text", async () => {
  await call(settings.put, { user: admin, body: { notice: "Pay at the front desk first.", paymentInstructions: "Ask for Mrs Ade." } });
  const seen = await call(access.info, { user: as("s1") });
  assert.equal(seen.body.notice, "Pay at the front desk first."); assert.equal(seen.body.paymentInstructions, "Ask for Mrs Ade.");
  assert.ok(!JSON.stringify(audits).includes("front desk"));
  await call(settings.put, { user: admin, body: { notice: "" } });
  assert.match((await call(access.info, { user: as("s1") })).body.notice, /office must confirm/);
  assert.equal((await call(settings.get, { user: admin })).body.isDefault.notice, true);
});

// ---------- official verification ----------
test("verification needs the identity document seen; an under-18 also needs a guardian contacted", async () => {
  const v = (id, body) => call(people.setVerification, { user: admin, params: { id }, body });
  assert.equal((await v("s1", { action: "verify" })).statusCode, 400);
  assert.equal((await v("s2", { action: "verify", identityDocumentSeen: true })).statusCode, 400);   // Bayo is a minor
  assert.equal((await v("s2", { action: "verify", identityDocumentSeen: true, guardianContacted: true })).statusCode, 200);
  assert.equal((await v("s1", { action: "verify", identityDocumentSeen: true })).statusCode, 200);
  assert.equal((await rec("s1")).body.access.verification.status, "verified");
  assert.equal((await v("s1", { action: "verify", identityDocumentSeen: true })).statusCode, 409);   // already verified
});
test("removing a verification needs a reason and leaves a revoked record", async () => {
  await call(people.setVerification, { user: admin, params: { id: "s1" }, body: { action: "verify", identityDocumentSeen: true } });
  assert.equal((await call(people.setVerification, { user: admin, params: { id: "s1" }, body: { action: "revoke", note: "no" } })).statusCode, 400);
  assert.equal((await call(people.setVerification, { user: admin, params: { id: "s1" }, body: { action: "revoke", note: "Documents did not match" } })).statusCode, 200);
  assert.equal(db.access[0].verification.status, "revoked");
  assert.equal((await call(people.setVerification, { user: admin, params: { id: "s1" }, body: { action: "revoke", note: "Documents did not match" } })).statusCode, 409);
});

// ---------- deleting an account ----------
const seedFootprint = () => {
  db.convs.push({ _id: "c1", studentId: "s1" });
  db.messages.push({ _id: "m1", conversationId: "c1", body: "private" }, { _id: "m2", conversationId: "c1", body: "more" }, { _id: "m9", conversationId: "other", body: "keep" });
  db.files.push({ _id: "f1", conversationId: "c1" });
  db.enrolments.push({ _id: "e1", userId: "s1", reference: "PET-ENR-1" }, { _id: "e2", userId: "s2", reference: "PET-ENR-2" });
  db.access.push({ _id: "a1", userId: "s1", payments: [] }, { _id: "a2", userId: "s2", payments: [] });
  db.attendance.push({ _id: "t1", studentId: "s1" }, { _id: "t2", studentId: "s2" });
  db.otps.push({ _id: "o1", email: "ada@x.com" });
};
const del = (id, body, user = admin) => call(people.remove, { user, params: { id }, body });
test("deleting needs the exact student ID; a wrong or missing confirmation changes nothing", async () => {
  seedFootprint();
  const r = await del("s1", { confirm: "PET-WRONG", reason: "Left the centre" });
  assert.equal(r.statusCode, 400); assert.equal(r.body.code, "CONFIRM_MISMATCH");
  assert.equal(db.users.find((u) => u._id === "s1").email, "ada@x.com");
  assert.equal(db.messages.length, 3);
});
test("deleting closes the account first and erases the person's data, and only theirs", async () => {
  seedFootprint();
  const r = await del("s1", { confirm: "pet-ada1", reason: "Requested by parent" });
  assert.equal(r.statusCode, 200);
  const u = db.users.find((x) => x._id === "s1");
  assert.match(u.email, /^deleted-s1@deleted\.invalid$/);
  assert.equal(u.password, "UNUSABLE-HASH"); assert.equal(u.approval, "rejected"); assert.equal(u.isVerified, false);
  for (const gone of ["phone", "dob", "state", "studentId", "googleId", "otherNames"]) assert.equal(u[gone], undefined, `${gone} should be removed`);
  assert.deepEqual(db.messages.map((m) => m._id), ["m9"]);                     // only Ada's messages went
  assert.equal(db.files.length, 0); assert.equal(db.convs.length, 0);
  assert.deepEqual(db.enrolments.map((e) => e._id), ["e2"]);
  assert.deepEqual(db.access.map((a) => a._id), ["a2"]);
  assert.deepEqual(db.attendance.map((a) => a._id), ["t2"]);
  assert.equal(db.otps.length, 0);
  assert.deepEqual(r.body.erased, { files: 1, messages: 2, conversations: 1, enrolments: 1, access: 1, checkins: 1 });
});
test("the audit entry for a deletion names no one and holds no contact details", async () => {
  seedFootprint();
  await del("s1", { confirm: "PET-ADA1", reason: "Requested by parent" });
  const e = audits.find((a) => a.event === "account.deleted");
  assert.equal(e.entityId, "s1");
  const text = JSON.stringify(e);
  for (const leak of ["Ada", "Obi", "ada@x.com", "0801", "PET-ADA1"]) assert.ok(!text.includes(leak), `audit leaked ${leak}`);
});
test("administrators and your own account cannot be deleted; a parent is confirmed by email", async () => {
  assert.equal((await del("a-admin", { confirm: "chidi@x.com", reason: "Testing it out" }, { id: "someone-else", role: "admin" })).statusCode, 403);
  db.users.push({ _id: "a2", role: "admin", firstName: "Z", email: "z@x.com" });
  assert.equal((await del("a2", { confirm: "z@x.com", reason: "Testing it out" })).statusCode, 403);
  assert.equal((await del("p1", { confirm: "PET-X", reason: "Parent asked us" })).statusCode, 400);
  assert.equal((await del("p1", { confirm: "PAT@x.com", reason: "Parent asked us" })).statusCode, 200);
});
test("if a deletion stopped part-way, running it again finishes the clean-up without asking for the ID again", async () => {
  db.users.push({ _id: "half", role: "student", firstName: "Deleted", email: "deleted-half@deleted.invalid" });
  db.convs.push({ _id: "ch", studentId: "half" }); db.messages.push({ _id: "mh", conversationId: "ch" });
  const r = await del("half", { confirm: "anything", reason: "Finishing clean-up" });
  assert.equal(r.statusCode, 200);
  assert.equal(db.messages.some((m) => m._id === "mh"), false);
  assert.equal(audits.at(-1).meta.resumed, true);
});
