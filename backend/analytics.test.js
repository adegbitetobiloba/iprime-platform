const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStudentAnalytics, topicBand } = require("../utils/analytics");
const { scoreAttempt } = require("../utils/cbt");

const mk = (id, topic, correctKey = "A", marks = 1) => ({ _id: id, text: `Question ${id}`, topic, correctKey, marks, options: [{ key: "A", text: "x" }, { key: "B", text: "y" }] });
const exam = (id, subject, questions) => ({ _id: id, title: `Exam ${id}`, subject, questions });
// Builds a stored attempt exactly as the server would: the stored result IS scoreAttempt(), so it is verifiable.
const attempt = (id, ex, answers, day, extra = {}) => ({
  _id: id, examId: ex._id, status: "submitted",
  startedAt: new Date(`2026-10-${day}T10:00:00Z`), submittedAt: new Date(`2026-10-${day}T10:30:00Z`),
  answers, questionCount: ex.questions.length, ...scoreAttempt(ex.questions, answers), ...extra,
});

const qs = [mk("q1", "Algebra"), mk("q2", "Algebra"), mk("q3", "Algebra"), mk("q4", "Algebra"), mk("q5", "Algebra"), mk("q6", "Geometry"), mk("q7", undefined)];
const maths = exam("e1", "Mathematics", qs);

test("no attempts: empty, nothing invented", () => {
  const r = buildStudentAnalytics({});
  assert.equal(r.history.length, 0); assert.deepEqual(r.topics, []); assert.deepEqual(r.focus, []);
  assert.equal(r.totals.submittedAttempts, 0);
});

test("history copies persisted results and computes time used", () => {
  const a = attempt("a1", maths, { q1: "A", q2: "B" }, "01");
  const r = buildStudentAnalytics({ attempts: [a], exams: [maths] });
  assert.equal(r.history[0].percentage, a.percentage);
  assert.equal(r.history[0].timeUsedSeconds, 1800);
  assert.equal(r.history[0].subject, "Mathematics");
});

test("in-progress attempts are ignored", () => {
  const r = buildStudentAnalytics({ attempts: [{ _id: "x", examId: "e1", status: "in_progress", answers: {} }], exams: [maths] });
  assert.equal(r.history.length, 0);
});

test("topic mastery is marks-weighted, with evidence and bands", () => {
  const a = attempt("a1", maths, { q1: "A", q2: "A", q3: "B", q4: "B", q5: "B", q6: "A" }, "01");
  const r = buildStudentAnalytics({ attempts: [a], exams: [maths] });
  const alg = r.topics.find((t) => t.topic === "Algebra");
  assert.equal(alg.percentage, 40); assert.equal(alg.questions, 5); assert.equal(alg.band, "needs_practice");
  const geo = r.topics.find((t) => t.topic === "Geometry");
  assert.equal(geo.band, "not_enough_evidence"); // 1 question is not enough to label anyone
  assert.equal(r.untaggedQuestions, 1);
  assert.equal(r.focus.length, 1); assert.equal(r.focus[0].topic, "Algebra"); assert.equal(r.focus[0].kind, "recommendation");
});

test("band thresholds are documented values", () => {
  assert.equal(topicBand(70, 5), "strong"); assert.equal(topicBand(69.9, 5), "developing");
  assert.equal(topicBand(49.9, 5), "needs_practice"); assert.equal(topicBand(10, 4), "not_enough_evidence");
});

test("recurring misses need two separate attempts and trace to attempt ids", () => {
  const a1 = attempt("a1", maths, { q1: "B", q2: "A" }, "01");
  const a2 = attempt("a2", maths, { q1: "B", q2: "A" }, "02");
  const r = buildStudentAnalytics({ attempts: [a1, a2], exams: [maths] });
  const q1 = r.recurringMisses.find((m) => m.questionId === "q1");
  assert.equal(q1.timesMissed, 2); assert.deepEqual(q1.attemptIds, ["a1", "a2"]);
  assert.equal(r.recurringMisses.find((m) => m.questionId === "q2"), undefined);
});

test("skipped question counts as missed", () => {
  const a1 = attempt("a1", maths, {}, "01");
  const a2 = attempt("a2", maths, {}, "02");
  const r = buildStudentAnalytics({ attempts: [a1, a2], exams: [maths] });
  assert.equal(r.recurringMisses.find((m) => m.questionId === "q1").timesMissed, 2);
});

test("retest comparison: first against latest, oldest-first regardless of input order", () => {
  const a1 = attempt("a1", maths, { q1: "B" }, "01");
  const a2 = attempt("a2", maths, { q1: "A", q2: "A", q3: "A" }, "05");
  const r = buildStudentAnalytics({ attempts: [a2, a1], exams: [maths] });
  assert.equal(r.retests.length, 1);
  assert.equal(r.retests[0].firstAttemptId, "a1"); assert.equal(r.retests[0].latestAttemptId, "a2");
  assert.equal(r.retests[0].change, Math.round((a2.percentage - a1.percentage) * 10) / 10);
});

test("an exam edited after the attempt is reported as unverifiable and kept out of question analysis", () => {
  const a = attempt("a1", maths, { q1: "A" }, "01");
  const edited = exam("e1", "Mathematics", [...qs.slice(0, 6)]); // a question was removed afterwards
  const r = buildStudentAnalytics({ attempts: [a], exams: [edited] });
  assert.equal(r.history.length, 1);               // the stored score still appears
  assert.equal(r.totals.unverifiable, 1);
  assert.deepEqual(r.topics, []);
  assert.match(r.unverifiable[0].reason, /changed/);
});

test("a deleted exam is unverifiable but its stored score is kept", () => {
  const a = attempt("a1", maths, { q1: "A" }, "01");
  const r = buildStudentAnalytics({ attempts: [a], exams: [] });
  assert.equal(r.history[0].examTitle, "Examination"); assert.equal(r.totals.unverifiable, 1);
});

test("auto-submitted attempts are counted and labelled", () => {
  const a = attempt("a1", maths, { q1: "A" }, "01", { autoSubmitted: true });
  assert.equal(buildStudentAnalytics({ attempts: [a], exams: [maths] }).history[0].autoSubmitted, true);
});

test("output never contains a correct key or explanation", () => {
  const withExplain = exam("e1", "Mathematics", qs.map((q) => ({ ...q, explanation: "SECRET-EXPLANATION" })));
  const a = attempt("a1", withExplain, { q1: "B" }, "01");
  const b = attempt("a2", withExplain, { q1: "B" }, "02");
  const json = JSON.stringify(buildStudentAnalytics({ attempts: [a, b], exams: [withExplain] }));
  assert.ok(!json.includes("correctKey")); assert.ok(!json.includes("SECRET-EXPLANATION"));
});
