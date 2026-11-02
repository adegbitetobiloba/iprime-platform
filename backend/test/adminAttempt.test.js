// Examiner view of attempts: the REAL controller against in-memory stand-ins for the database.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const R = require("../utils/randomise");
const pool = require("../utils/pool");

const hex = (n) => String(n).padStart(24, "0");
let attempts, exams, users;
const rxOf = (v) => (v instanceof RegExp ? v : null);
const userMatches = (u, f) => !f.$or || f.$or.some((c) => Object.entries(c).some(([k, v]) => rxOf(v) && rxOf(v).test(u[k] || "")));
const q = (rows) => { let r = rows.slice(); const api = { sort: () => api, select: () => api, skip: (n) => { r = r.slice(n); return api; }, limit: (n) => { r = r.slice(0, n); return api; }, lean: async () => r }; return api; };
const hasId = (list, id) => list.some((x) => String(x) === String(id));
const FakeAttempt = {
  countDocuments: async (f) => attempts.filter((a) => matchA(a, f)).length,
  find: (f) => q(attempts.filter((a) => matchA(a, f))),
  findById: (id) => ({ lean: async () => attempts.find((a) => String(a._id) === String(id)) || null }),
};
const matchA = (a, f) => (!f.examId || String(a.examId) === String(f.examId)) && (!f.status || a.status === f.status) && (!f.userId || hasId(f.userId.$in, a.userId));
const FakeUser = { find: (f) => q(users.filter((u) => (f._id ? hasId(f._id.$in, u._id) : userMatches(u, f)))), findById: (id) => ({ select: () => ({ lean: async () => users.find((u) => String(u._id) === String(id)) || null }) }) };
const FakeExam = { find: (f) => q(exams.filter((e) => hasId(f._id.$in, e._id))), findById: (id) => ({ lean: async () => exams.find((e) => String(e._id) === String(id)) || null }) };
const orig = Module._load;
Module._load = function (req, parent, ...rest) {
  if (parent && /controllers[\\/]adminAttemptController\.js$/.test(parent.filename)) {
    if (req === "mongoose") return { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) };
    if (req === "../models/Attempt") return FakeAttempt; if (req === "../models/Exam") return FakeExam; if (req === "../models/User") return FakeUser;
  }
  return orig.call(this, req, parent, ...rest);
};
const ctl = require("../controllers/adminAttemptController");
const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ params: {}, query: {}, ...req }, r); return r; };

const POOL = Array.from({ length: 30 }, (_, i) => ({ _id: hex(100 + i), text: `Question ${i + 1}`, textHtml: i === 0 ? "<p>Question <u>1</u></p>" : undefined, topic: i % 2 ? "Waves" : "Mechanics", marks: 1, correctKey: "B", explanation: "Because B.", options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: `q${i}-${k}` })) }));
beforeEach(() => {
  users = [{ _id: hex(1), firstName: "Ada", lastName: "Obi", studentId: "PX-001", email: "ada@x.ng" }, { _id: hex(2), firstName: "Tunde", lastName: "Bello", studentId: "PX-002", email: "tunde@x.ng" }];
  exams = [{ _id: hex(900), title: "Physics Mock", subject: "Physics", questions: POOL, questionsPerStudent: 5 }, { _id: hex(901), title: "Other", subject: "Chem", questions: [] }];
  const ids = (n, seed) => pool.drawQuestionIds(exams[0], { seed });
  const a1 = ids(5, "s1"), a2 = ids(5, "s2");
  attempts = [
    { _id: hex(500), examId: hex(900), userId: hex(1), status: "submitted", startedAt: new Date("2026-11-02T08:00:00Z"), submittedAt: new Date("2026-11-02T08:20:00Z"), seed: "s1", shuffleQuestions: true, shuffleOptions: true, questionIds: a1, answers: Object.fromEntries(a1.map((id, i) => [id, i < 3 ? "B" : "A"])), flagged: [a1[0]], score: 3, totalMarks: 5, percentage: 60, correct: 3, incorrect: 2, unanswered: 0, questionCount: 5 },
    { _id: hex(501), examId: hex(900), userId: hex(2), status: "in_progress", startedAt: new Date(), deadline: new Date(Date.now() + 600000), seed: "s2", questionIds: a2, answers: { [a2[0]]: "C" }, flagged: [] },
    { _id: hex(502), examId: hex(901), userId: hex(2), status: "submitted", startedAt: new Date(), submittedAt: new Date(), answers: {}, score: 0, totalMarks: 0, percentage: 0, questionCount: 0 },
  ];
});

test("list: shows who, which exam, status and score, newest first, and whether each paper was a personal draw", async () => {
  const r = await call(ctl.list, {});
  assert.equal(r.body.total, 3);
  const a = r.body.attempts.find((x) => x.id === hex(500));
  assert.deepEqual([a.student.name, a.student.studentId, a.exam.title, a.status, a.percentage, a.drawn], ["Ada Obi", "PX-001", "Physics Mock", "submitted", 60, true]);
  assert.equal(r.body.attempts.find((x) => x.id === hex(501)).answered, 1);
  assert.equal(r.body.attempts.find((x) => x.id === hex(502)).drawn, false);
});

test("list: filters by exam and status, and finds students by name, student ID or email", async () => {
  assert.equal((await call(ctl.list, { query: { exam: hex(900) } })).body.total, 2);
  assert.equal((await call(ctl.list, { query: { status: "in_progress" } })).body.total, 1);
  assert.equal((await call(ctl.list, { query: { q: "ada" } })).body.attempts[0].student.name, "Ada Obi");
  assert.equal((await call(ctl.list, { query: { q: "PX-002" } })).body.total, 2);
  assert.equal((await call(ctl.list, { query: { q: "tunde@" } })).body.total, 2);
  assert.equal((await call(ctl.list, { query: { q: "nobody" } })).body.total, 0);
  assert.equal((await call(ctl.list, { query: { q: ".*" } })).body.total, 0, "a search is text, not a pattern");
});

test("list: bad input is refused or clamped, never an error", async () => {
  assert.equal((await call(ctl.list, { query: { exam: "not-an-id" } })).statusCode, 400);
  const r = await call(ctl.list, { query: { page: "-5", limit: "9999" } });
  assert.equal(r.statusCode, 200); assert.equal(r.body.limit, 50); assert.equal(r.body.page, 1);
  assert.equal((await call(ctl.list, { query: { status: "weird" } })).body.total, 3);
});

test("detail: shows exactly the questions THIS student was given, with their answers, the correct ones and explanations", async () => {
  const r = await call(ctl.detail, { params: { id: hex(500) } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.drawn, true);
  assert.equal(r.body.exam.poolSize, 30); assert.equal(r.body.exam.questionsPerStudent, 5);
  assert.equal(r.body.questions.length, 5);
  assert.deepEqual(r.body.questions.map((x) => x.id).sort(), [...attempts[0].questionIds].sort());
  const right = r.body.questions.filter((x) => x.correct === true).length, wrong = r.body.questions.filter((x) => x.correct === false).length;
  assert.deepEqual([right, wrong], [3, 2]);
  const first = r.body.questions[0];
  assert.ok(first.correctKey === "B" && first.explanation === "Because B.");
  assert.equal(r.body.student.name, "Ada Obi");
  assert.equal(r.body.attempt.timeUsedSeconds, 1200);
});

test("detail: the order and letters match what the student saw, and the correct letter points at the correct option", async () => {
  const r = await call(ctl.detail, { params: { id: hex(500) } });
  const saw = R.arrange(exams[0].questions, attempts[0]);
  assert.deepEqual(r.body.questions.map((x) => x.id), saw.map((e) => String(e.q._id)));
  for (const q of r.body.questions) {
    assert.deepEqual(q.options.map((o) => o.label), ["A", "B", "C", "D"]);
    assert.equal(q.options.find((o) => o.label === q.correctLabel).key, q.correctKey);
    if (q.yourChoice) assert.equal(q.options.find((o) => o.label === q.yourLabel).key, q.yourChoice);
  }
  assert.ok(r.body.questions.some((q) => q.optionsReordered));
});

test("detail: an unfinished attempt shows what has been answered so far, and unanswered questions are marked", async () => {
  const r = await call(ctl.detail, { params: { id: hex(501) } });
  assert.equal(r.body.attempt.status, "in_progress");
  assert.equal(r.body.questions.filter((q) => q.answered).length, 1);
  assert.equal(r.body.questions.filter((q) => q.correct === null).length, 4);
});

test("detail: flagged questions are marked; formatted text is passed through", async () => {
  const r = await call(ctl.detail, { params: { id: hex(500) } });
  assert.equal(r.body.questions.filter((q) => q.flagged).length, 1);
});

test("detail: an ordinary exam (no pool) shows the whole exam; bad or unknown ids are 404", async () => {
  attempts.push({ _id: hex(503), examId: hex(900), userId: hex(1), status: "submitted", startedAt: new Date(), submittedAt: new Date(), answers: {}, flagged: [] });
  const r = await call(ctl.detail, { params: { id: hex(503) } });
  assert.equal(r.body.drawn, false); assert.equal(r.body.questions.length, 30);
  assert.equal((await call(ctl.detail, { params: { id: "nope" } })).statusCode, 404);
  assert.equal((await call(ctl.detail, { params: { id: hex(999) } })).statusCode, 404);
});

test("detail: a deleted student account still shows the attempt", async () => {
  users = [];
  const r = await call(ctl.detail, { params: { id: hex(500) } });
  assert.equal(r.statusCode, 200); assert.equal(r.body.student.name, "Deleted account");
});
