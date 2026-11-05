const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { activeSeconds } = require("../utils/analytics");
const { restrictToSubjects, summarise, studentView } = require("../utils/teacherAnalytics");
const { makeModel, res, install, calls, newId } = require("./support/teacherFakes");

const q = (id, topic, correct = "A") => ({ _id: id, text: `Q ${id}`, topic, options: ["A", "B"], correctAnswer: correct, marks: 1 });
const mkExam = (id, subject) => ({ _id: id, title: `${subject} test`, subject, questions: [q("q1", "Algebra"), q("q2", "Algebra")] });
const mkAttempt = (examId, pct, day, extra = {}) => ({ _id: newId(), userId: "s1", examId, status: "submitted", percentage: pct, score: pct, totalMarks: 100, submittedAt: new Date(2026, 9, day), startedAt: new Date(2026, 9, day, 0, 0), answers: [], ...extra });

test("time used excludes admin-paused time and is never negative", () => {
  const start = new Date("2026-10-01T10:00:00Z"), end = new Date("2026-10-01T10:30:00Z");
  assert.equal(activeSeconds({ startedAt: start, submittedAt: end }), 1800);
  assert.equal(activeSeconds({ startedAt: start, submittedAt: end, pausedTotalSeconds: 600 }), 1200);
  assert.equal(activeSeconds({ startedAt: start, submittedAt: end, pausedTotalSeconds: 99999 }), 0);
  assert.equal(activeSeconds({ startedAt: start }), null);
});

test("subject restriction keeps only matching exams, ignoring case; no subjects means no restriction", () => {
  const exams = [mkExam("e1", "Biology"), mkExam("e2", "Physics")];
  const attempts = [mkAttempt("e1", 50, 1), mkAttempt("e2", 60, 2)];
  const r = restrictToSubjects({ attempts, exams, subjects: [" biology "] });
  assert.equal(r.restricted, true);
  assert.deepEqual(r.attempts.map((a) => a.examId), ["e1"]);
  assert.equal(restrictToSubjects({ attempts, exams, subjects: [] }).attempts.length, 2);
  assert.equal(restrictToSubjects({ attempts, exams, subjects: undefined }).restricted, false);
});

test("trend needs at least three attempts and uses plain thresholds", () => {
  const exams = [mkExam("e1", "Biology")];
  const sum = (pcts) => studentView({ attempts: pcts.map((p, i) => mkAttempt("e1", p, i + 1)), exams }).summary;
  assert.equal(sum([40, 60]).trend, "not_enough_data");
  assert.equal(sum([40, 40, 60]).trend, "improving");
  assert.equal(sum([70, 70, 50]).trend, "declining");
  assert.equal(sum([60, 60, 62]).trend, "steady");
  assert.equal(sum([]).latest, null);
  assert.equal(sum([]).checkIn, false);
});

test("check-in flag is set only when the latest result is under 40", () => {
  const exams = [mkExam("e1", "Biology")];
  assert.equal(studentView({ attempts: [mkAttempt("e1", 80, 1), mkAttempt("e1", 35, 2)], exams }).summary.checkIn, true);
  assert.equal(studentView({ attempts: [mkAttempt("e1", 20, 1), mkAttempt("e1", 55, 2)], exams }).summary.checkIn, false);
});

test("the teacher view never contains correct answers or explanations", () => {
  const exams = [mkExam("e1", "Biology")];
  const v = studentView({ attempts: [mkAttempt("e1", 50, 1, { answers: [{ questionId: "q1", selected: "B" }] })], exams });
  const text = JSON.stringify(v);
  assert.doesNotMatch(text, /correctAnswer|explanation/);
});

// ---- controller flow with in-memory models ----
function setup({ assignments, users, attempts, exams }) {
  const User = makeModel(users), TeacherAssignment = makeModel(assignments), Attempt = makeModel(attempts), Exam = makeModel(exams);
  const audit = calls();
  const restore = install({
    "models/User": User, "models/TeacherAssignment": TeacherAssignment, "models/Attempt": Attempt, "models/Exam": Exam,
    "utils/audit": { audit },
    mongoose: { isValidObjectId: (s) => /^[0-9a-f]{24}$/.test(String(s)) },
  });
  delete require.cache[require.resolve("../controllers/teacherAnalyticsController")];
  const c = require("../controllers/teacherAnalyticsController");
  return { c, audit, restore };
}
const T = "a".repeat(24), S1 = "b".repeat(24), S2 = "c".repeat(24), S3 = "d".repeat(24);
const students = () => [
  { _id: S1, role: "student", firstName: "Ada", lastName: "Eze", studentId: "IP-1", approval: "approved", email: "x@y.z", phone: "080" },
  { _id: S2, role: "student", firstName: "Bayo", lastName: "Ola", studentId: "IP-2", approval: "approved" },
  { _id: S3, role: "student", firstName: "Chi", lastName: "Uko", studentId: "IP-3", approval: "suspended" },
];

test("list: only actively assigned, approved students; no contact fields; subject scope applied", async () => {
  const { c, restore } = setup({
    assignments: [
      { teacherId: T, studentId: S1, status: "active", subjects: ["Biology"] },
      { teacherId: T, studentId: S2, status: "ended" },
      { teacherId: T, studentId: S3, status: "active" },
    ],
    users: students(),
    exams: [mkExam("e1", "Biology"), mkExam("e2", "Physics")],
    attempts: [{ ...mkAttempt("e1", 30, 1), userId: S1 }, { ...mkAttempt("e2", 90, 2), userId: S1 }, { ...mkAttempt("e1", 80, 3), userId: S2 }],
  });
  try {
    const r = res(); await c.list({ user: { id: T } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.students.length, 1); // S2 ended, S3 suspended
    const s = r.body.students[0];
    assert.equal(s.studentId, "IP-1");
    assert.equal(s.attempts, 1);          // Physics attempt hidden by subject scope
    assert.equal(s.checkIn, true);        // 30 < 40
    assert.doesNotMatch(JSON.stringify(r.body), /x@y\.z|080|email|phone/);
  } finally { restore(); }
});

test("one: unassigned, ended, suspended and malformed ids all get the same 404; no audit entry for them", async () => {
  const { c, audit, restore } = setup({
    assignments: [{ teacherId: T, studentId: S2, status: "ended" }, { teacherId: T, studentId: S3, status: "active" }],
    users: students(), exams: [], attempts: [],
  });
  try {
    const bodies = [];
    for (const id of [S1, S2, S3, "nope", "e".repeat(24)]) { const r = res(); await c.one({ user: { id: T }, params: { studentId: id } }, r); assert.equal(r.statusCode, 404, id); bodies.push(JSON.stringify(r.body)); }
    assert.equal(new Set(bodies).size, 1);
    assert.equal(audit.calls.length, 0);
  } finally { restore(); }
});

test("one: an assigned student is returned, the view is audited first, and another teacher's student stays hidden", async () => {
  const { c, audit, restore } = setup({
    assignments: [{ teacherId: T, studentId: S1, status: "active" }, { teacherId: "f".repeat(24), studentId: S2, status: "active" }],
    users: students(), exams: [mkExam("e1", "Biology")], attempts: [{ ...mkAttempt("e1", 55, 1), userId: S1 }],
  });
  try {
    const r = res(); await c.one({ user: { id: T }, params: { studentId: S1 } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.student.studentId, "IP-1");
    assert.equal(r.body.history.length, 1);
    assert.equal(audit.calls.length, 1);
    assert.equal(audit.calls[0][1].event, "analytics.teacher_viewed_student");
    const other = res(); await c.one({ user: { id: T }, params: { studentId: S2 } }, other);
    assert.equal(other.statusCode, 404);
  } finally { restore(); }
});

test("one: if the audit entry cannot be written, no student data is sent", async () => {
  const User = makeModel(students()), TA = makeModel([{ teacherId: T, studentId: S1, status: "active" }]);
  const restore = install({
    "models/User": User, "models/TeacherAssignment": TA, "models/Attempt": makeModel([]), "models/Exam": makeModel([]),
    "utils/audit": { audit: async () => { throw new Error("db down"); } },
    mongoose: { isValidObjectId: (s) => /^[0-9a-f]{24}$/.test(String(s)) },
  });
  delete require.cache[require.resolve("../controllers/teacherAnalyticsController")];
  const c = require("../controllers/teacherAnalyticsController");
  const origErr = console.error; console.error = () => {};
  try {
    const r = res(); await c.one({ user: { id: T }, params: { studentId: S1 } }, r);
    assert.equal(r.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(r.body), /Ada|IP-1|db down/);
  } finally { console.error = origErr; restore(); }
});

test("wiring: teacher analytics is gated by protect + requireTeacher and mounted before the CBT router", () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const r = read("routes/teacherAnalyticsRoutes.js");
  assert.ok(r.indexOf("router.use(protect, requireTeacher)") < r.indexOf("router.get("));
  const app = read("app.js");
  const m = app.indexOf('app.use("/api/teacher/analytics"');
  assert.ok(m > 0 && m < app.indexOf('app.use("/api/teacher"') && m < app.indexOf('app.use("/api", cbtRoutes)'));
});
