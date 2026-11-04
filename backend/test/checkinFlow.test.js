// Real check-in controller against in-memory stand-ins.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./helpers/fakes");
const R = require("../utils/accessRules");

let db, audits, raceOnce = false;
const M = (name, opts) => new Proxy({}, { get: (_, k) => F.model(db[name], opts)[k] });
F.install({
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  "../models/User": M("users", { prefix: "u" }), "../models/StudentAccess": M("access", { prefix: "a" }),
  "../models/Attendance": M("attendance", { prefix: "t", defaults: { active: true }, unique: [["studentId", "day", "session"]], where: (r) => r.active, onCreate: () => (raceOnce ? ((raceOnce = false), Object.assign(new Error("E11000"), { code: 11000 })) : null) }),
  "../utils/paging": F.paging, "../utils/audit": { audit: async (req, e) => { audits.push(e); } },
}, /adminCheckinController\.js$/);
const c = require("../controllers/adminCheckinController");
const { call } = F;
const admin = { id: "a1", role: "admin" };

beforeEach(() => {
  F.resetIds(); audits = [];
  db = { users: [], access: [], attendance: [] };
  db.users.push(
    { _id: "s1", role: "student", firstName: "Ada", lastName: "Obi", studentId: "PET-ADA1", approval: "approved", email: "ada@x.com" },
    { _id: "s2", role: "student", firstName: "Bayo", lastName: "Eze", studentId: "PET-BAY2", approval: "approved", email: "bayo@x.com" },
    { _id: "s3", role: "student", firstName: "Chika", lastName: "Pending", studentId: "PET-CHI3", approval: "pending", email: "c@x.com" },
    { _id: "t1", role: "teacher", firstName: "Tola", lastName: "T", email: "t@x.com" },
    { _id: "a1", role: "admin", firstName: "Chidi", lastName: "Admin", email: "chidi@x.com" },
    { _id: "gone", role: "student", firstName: "Deleted", lastName: "Account", email: "deleted-gone@deleted.invalid" },
  );
  db.access.push({ _id: "ax1", userId: "s1", verification: { status: "verified" }, payments: [] }, { _id: "ax3", userId: "s3", verification: { status: "verified" }, payments: [] });
});
const checkIn = (id, body = {}) => call(c.checkIn, { user: admin, params: { id }, body });

test("search needs 2+ characters and returns a card showing verification, approval and payment", async () => {
  assert.deepEqual((await call(c.search, { user: admin, query: { q: "a" } })).body.students, []);
  const r = await call(c.search, { user: admin, query: { q: "ada" } });
  const card = r.body.students[0];
  assert.equal(card.name, "Ada Obi"); assert.equal(card.verified, true); assert.equal(card.approved, true); assert.equal(card.paymentConfirmed, false); assert.equal(card.eligible, true);
  assert.match(r.body.day, /^\d{4}-\d{2}-\d{2}$/);
});
test("a scanned Student ID finds the student; teachers and deleted accounts never appear", async () => {
  assert.equal((await call(c.search, { user: admin, query: { q: "PET-BAY2" } })).body.students[0].name, "Bayo Eze");
  assert.deepEqual((await call(c.search, { user: admin, query: { q: "tola" } })).body.students, []);
  assert.deepEqual((await call(c.search, { user: admin, query: { q: "deleted" } })).body.students, []);
});
test("a verified, approved student is checked in and the register records who and when", async () => {
  const r = await checkIn("s1", { session: "morning", note: "Arrived early" });
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.checkIn.session, "morning"); assert.equal(r.body.checkIn.override, false);
  const row = db.attendance[0];
  assert.equal(row.studentId, "s1"); assert.equal(row.checkedInBy, "a1"); assert.equal(row.checkedInByName, "Chidi"); assert.equal(row.day, R.lagosDay());
  assert.deepEqual(audits.map((a) => a.event), ["attendance.checked_in"]);
});
test("an unverified student is refused with the reasons, unless the administrator gives a reason to override", async () => {
  const no = await checkIn("s2", { session: "morning" });
  assert.equal(no.statusCode, 409); assert.equal(no.body.code, "NOT_ELIGIBLE");
  assert.match(no.body.reasons[0], /verified/);
  assert.deepEqual(no.body.errors, no.body.reasons);   // the page reads them from "errors"
  assert.equal(db.attendance.length, 0);
  assert.equal((await checkIn("s2", { session: "morning", overrideReason: "no" })).statusCode, 409);   // too short
  const ok = await checkIn("s2", { session: "morning", overrideReason: "ID being verified at the desk" });
  assert.equal(ok.statusCode, 201); assert.equal(ok.body.checkIn.override, true);
  assert.equal(db.attendance[0].overrideReason, "ID being verified at the desk");
});
test("an account that is not approved cannot be checked in normally even when verified", async () => {
  const r = await checkIn("s3", { session: "morning" });
  assert.equal(r.statusCode, 409); assert.ok(r.body.reasons.some((x) => /not approved/.test(x)));
});
test("a second check-in in the same session is refused; another session is allowed", async () => {
  await checkIn("s1", { session: "morning" });
  const again = await checkIn("s1", { session: "morning" });
  assert.equal(again.statusCode, 409); assert.equal(again.body.code, "ALREADY_CHECKED_IN");
  assert.equal((await checkIn("s1", { session: "evening" })).statusCode, 201);
  assert.equal(db.attendance.length, 2);
});
test("two staff checking in the same student at the same instant: the database rule makes the loser see 'already checked in'", async () => {
  raceOnce = true; // the duplicate check passes, then the insert collides with the other staff member's row
  const r = await checkIn("s1", { session: "afternoon" });
  assert.equal(r.statusCode, 409); assert.equal(r.body.code, "ALREADY_CHECKED_IN");
  assert.equal(db.attendance.length, 0);
});
test("unknown people and non-students are 'not found'", async () => {
  for (const id of ["nobody", "t1", "a1"]) assert.equal((await checkIn(id)).statusCode, 404);
});
test("the day register counts sessions and names who checked each student in", async () => {
  await checkIn("s1", { session: "morning" }); await checkIn("s1", { session: "evening" });
  const r = await call(c.register, { user: admin, query: {} });
  assert.equal(r.body.total, 2); assert.deepEqual(r.body.counts, { morning: 1, afternoon: 0, evening: 1 });
  assert.equal(r.body.entries[0].name, "Ada Obi"); assert.equal(r.body.entries[0].by, "Chidi");
  assert.equal((await call(c.register, { user: admin, query: { day: "2020-01-01" } })).body.total, 0);
});
test("a mistaken check-in is voided with a reason, not deleted, and the student can then be checked in again", async () => {
  const made = await checkIn("s1", { session: "morning" });
  const id = made.body.checkIn.id;
  assert.equal((await call(c.voidCheckIn, { user: admin, params: { id }, body: { reason: "Wrong student at the desk" } })).statusCode, 200);
  assert.equal(db.attendance.length, 1);                                  // kept as a record
  assert.equal(db.attendance[0].voidReason, "Wrong student at the desk");
  assert.equal((await call(c.register, { user: admin, query: {} })).body.total, 0);
  assert.equal((await checkIn("s1", { session: "morning" })).statusCode, 201);
  assert.equal((await call(c.voidCheckIn, { user: admin, params: { id }, body: { reason: "Wrong student at the desk" } })).statusCode, 404); // already voided
});
