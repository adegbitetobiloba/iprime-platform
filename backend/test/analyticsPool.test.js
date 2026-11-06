const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStudentAnalytics } = require("../utils/analytics");
const { buildExamCohort } = require("../utils/cohortAnalytics");
const { scoreAttempt } = require("../utils/cbt");

// Synthetic data only. A pooled mock of 6 questions across two subjects; each student is given a draw of 4.
const Q = (id, subject, topic) => ({ _id: id, text: `Q ${id}`, subject, topic, options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], correctKey: "A", marks: 1 });
const exam = { _id: "e1", title: "Mixed mock", subject: "Mixed", questionsPerStudent: 4, questions: [Q("q1", "Biology", "Cells"), Q("q2", "Biology", "Cells"), Q("q3", "Biology", "Genetics"), Q("q4", "Physics", "Motion"), Q("q5", "Physics", "Motion"), Q("q6", "Physics", "Heat")] };

function attempt(id, user, drawIds, answers, day) {
  const served = drawIds ? drawIds.map((i) => exam.questions.find((q) => q._id === i)) : exam.questions;
  const r = scoreAttempt(served, answers);
  return { _id: id, userId: user, examId: "e1", status: "submitted", submittedAt: new Date(2026, 9, day), startedAt: new Date(2026, 9, day), answers, ...(drawIds ? { questionIds: drawIds } : {}), ...r };
}

test("a pooled attempt is graded on its own draw, so it is NOT dropped as unverifiable", () => {
  const a = attempt("a1", "s1", ["q1", "q2", "q4", "q5"], { q1: "A", q2: "B", q4: "A" }, 1);
  const out = buildStudentAnalytics({ attempts: [a], exams: [exam] });
  assert.equal(out.totals.verifiedForQuestionAnalysis, 1);
  assert.equal(out.totals.unverifiable, 0);
  const cells = out.topics.find((t) => t.topic === "Cells");
  assert.equal(cells.questions, 2); // only the two Cells questions this student was given
  assert.equal(out.topics.find((t) => t.topic === "Genetics"), undefined); // never drawn, so not invented
});

test("an attempt whose draw lists a question that no longer exists is still reported as unverifiable", () => {
  const a = { ...attempt("a1", "s1", ["q1", "q2", "q4", "q5"], { q1: "A" }, 1), questionIds: ["q1", "q2", "q4", "gone"] };
  const out = buildStudentAnalytics({ attempts: [a], exams: [exam] });
  assert.equal(out.totals.unverifiable, 1);
});

test("subject breakdown: per subject across attempts and inside each attempt", () => {
  const a = attempt("a1", "s1", null, { q1: "A", q2: "A", q3: "A", q4: "B", q5: "B", q6: "A" }, 1);
  const out = buildStudentAnalytics({ attempts: [a], exams: [exam] });
  const bio = out.subjects.find((s) => s.subject === "Biology");
  const phy = out.subjects.find((s) => s.subject === "Physics");
  assert.equal(bio.percentage, 100);
  assert.equal(phy.percentage, 33.3);
  assert.equal(bio.band, "not_enough_evidence"); // only 3 questions: below the 5-question rule
  const h = out.history[0].subjectBreakdown;
  assert.deepEqual(h.map((x) => [x.subject, x.earned, x.available]), [["Biology", 3, 3], ["Physics", 1, 3]]);
});

test("a question without its own subject falls back to the exam's subject, and a missing subject is labelled, not guessed", () => {
  const e2 = { _id: "e2", title: "Plain", subject: "Chemistry", questions: [{ ...Q("c1", undefined, "Acids") }, { ...Q("c2", undefined, "Acids") }] };
  const e3 = { _id: "e3", title: "None", subject: "", questions: [{ ...Q("n1", undefined, "X") }] };
  const mk = (id, ex, q) => ({ _id: id, userId: "s1", examId: ex._id, status: "submitted", submittedAt: new Date(2026, 9, 2), answers: { [q]: "A" }, ...scoreAttempt(ex.questions, { [q]: "A" }) });
  const out = buildStudentAnalytics({ attempts: [mk("x1", e2, "c1"), mk("x2", e3, "n1")], exams: [e2, e3] });
  assert.ok(out.subjects.find((s) => s.subject === "Chemistry"));
  assert.ok(out.subjects.find((s) => s.subject === "Subject not set"));
});

test("subject breakdown never carries keys or explanations", () => {
  const a = attempt("a1", "s1", null, { q1: "B" }, 1);
  const text = JSON.stringify(buildStudentAnalytics({ attempts: [a], exams: [exam] }));
  assert.doesNotMatch(text, /correctKey|explanation/);
});

// ---- cohort ----
function cohortAttempts(n) {
  const draws = [["q1", "q2", "q4", "q5"], ["q2", "q3", "q5", "q6"], ["q1", "q3", "q4", "q6"]];
  return Array.from({ length: n }, (_, i) => attempt(`c${i}`, `u${i}`, draws[i % 3], Object.fromEntries(draws[i % 3].map((id) => [id, i % 2 ? "A" : "B"])), 1 + i));
}

test("cohort: pooled attempts verify, and each question is measured only over the students who saw it", () => {
  const out = buildExamCohort({ exam, attempts: cohortAttempts(9) });
  assert.equal(out.questionBasis.verifiedStudents, 9);
  assert.equal(out.questionBasis.unverifiable, 0);
  for (const q of out.hardest) assert.ok(q.answeredBy >= 5 && q.answeredBy <= 9);
  assert.equal(out.exam.questionsPerStudent, 4);
});

test("cohort: a question seen by fewer than 5 students is not ranked as 'hardest'", () => {
  const out = buildExamCohort({ exam, attempts: cohortAttempts(9) });
  // each question is drawn by 6 of 9 students in this fixture; with 5 students it drops below the threshold
  const few = buildExamCohort({ exam, attempts: cohortAttempts(5) });
  for (const q of few.hardest) assert.ok(q.answeredBy >= 5);
  assert.ok(out.hardest.length >= few.hardest.length);
});

test("cohort: subject summary is included", () => {
  const out = buildExamCohort({ exam, attempts: cohortAttempts(9) });
  assert.deepEqual(out.subjects.map((s) => s.subject).sort(), ["Biology", "Physics"]);
});
