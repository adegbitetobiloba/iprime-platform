const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLibraryStudy, statusFor } = require("../utils/libraryStudy");

const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 3600 * 1000);
const stu = (id, first, sid) => ({ _id: id, firstName: first, lastName: "Test", studentId: sid, email: "x@y.z", phone: "080" });

test("empty: zero totals", () => {
  const r = buildLibraryStudy({ now });
  assert.deepEqual(r.totals, { students: 0, active: 0, quiet: 0, notStarted: 0, lessonsCompleted: 0, studyMinutes: 0 });
});

test("status rule: active under 14 days, quiet from 14, not started with no records", () => {
  assert.equal(statusFor(daysAgo(13), now), "active"); assert.equal(statusFor(daysAgo(14), now), "quiet"); assert.equal(statusFor(null, now), "not_started");
});

test("students without records are listed as not started, never dropped", () => {
  const r = buildLibraryStudy({ students: [stu("u1", "Ada", "P1"), stu("u2", "Bola", "P2")], rows: [{ _id: "u1", opened: 4, completed: 2, seconds: 1200, watched: 600, courses: 2, lastActiveAt: daysAgo(1) }], now });
  assert.equal(r.totals.students, 2); assert.equal(r.totals.active, 1); assert.equal(r.totals.notStarted, 1);
  assert.equal(r.students.find((s) => s.userId === "u1").studyMinutes, 30);
  assert.equal(r.students.find((s) => s.userId === "u2").status, "not_started");
});

test("sorted active, then quiet, then not started; newest activity first", () => {
  const r = buildLibraryStudy({ students: [stu("a", "A", "1"), stu("b", "B", "2"), stu("c", "C", "3"), stu("d", "D", "4")], rows: [{ _id: "a", opened: 1, lastActiveAt: daysAgo(30) }, { _id: "b", opened: 1, lastActiveAt: daysAgo(2) }, { _id: "c", opened: 1, lastActiveAt: daysAgo(1) }], now });
  assert.deepEqual(r.students.map((s) => s.userId), ["c", "b", "a", "d"]);
});

test("only name and student ID are exposed", () => {
  const json = JSON.stringify(buildLibraryStudy({ students: [stu("u1", "Ada", "P1")], now }));
  assert.ok(!json.includes("x@y.z")); assert.ok(!json.includes("080"));
});
