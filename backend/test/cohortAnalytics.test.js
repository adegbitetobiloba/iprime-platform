const test = require("node:test");
const assert = require("node:assert/strict");
const { buildExamCohort, quantile } = require("../utils/cohortAnalytics");
const { scoreAttempt } = require("../utils/cbt");

const q = (id, topic, correctKey = "A") => ({ _id: id, text: `Question ${id}`, topic, correctKey, marks: 1, options: [{ key: "A", text: "x" }, { key: "B", text: "y" }, { key: "C", text: "z" }] });
const exam = { _id: "e1", title: "Mock", subject: "Maths", questions: [q("q1", "Algebra"), q("q2", "Algebra"), q("q3", "Geometry"), q("q4", undefined)] };
let n = 0;
const att = (user, answers, extra = {}) => { n += 1; return { _id: `a${n}`, userId: user, examId: "e1", status: "submitted", startedAt: new Date(2026, 9, 1, 10), submittedAt: new Date(2026, 9, 1, 10, n), answers, ...scoreAttempt(exam.questions, answers), ...extra }; };
const all = (u) => ({ q1: "A", q2: "A", q3: "A", q4: "A" });

test("empty cohort: nothing invented", () => {
  const r = buildExamCohort({ exam, attempts: [] });
  assert.equal(r.participants, 0); assert.equal(r.stats.mean, null); assert.equal(r.limitedEvidence, true); assert.deepEqual(r.support, []);
});

test("quantile and basic stats", () => {
  assert.equal(quantile([10, 20, 30, 40], 0.5), 25);
  const r = buildExamCohort({ exam, attempts: [att("s1", all()), att("s2", { q1: "A", q2: "A" }), att("s3", {}), att("s4", { q1: "A" }), att("s5", { q1: "A", q2: "A", q3: "A" })] });
  assert.equal(r.participants, 5); assert.equal(r.stats.min, 0); assert.equal(r.stats.max, 100); assert.equal(r.stats.median, 50);
});

test("first attempt per student is the basis; retakers counted", () => {
  const first = att("s1", {}); const retake = att("s1", all());
  const r = buildExamCohort({ exam, attempts: [retake, first, att("s2", all())] });
  assert.equal(r.participants, 2); assert.equal(r.attemptsTotal, 3); assert.equal(r.retakers, 1);
  assert.equal(r.stats.min, 0); // s1's first (0%) counts, not the later 100%
});

test("distribution covers every participant, 100 goes in the top band", () => {
  const r = buildExamCohort({ exam, attempts: [att("s1", all()), att("s2", {}), att("s3", { q1: "A", q2: "A" })] });
  assert.equal(r.distribution.reduce((s, b) => s + b.count, 0), 3);
  assert.equal(r.distribution[9].count, 1); assert.equal(r.distribution[0].count, 1); assert.equal(r.distribution[5].count, 1);
});

test("ties share a rank (competition ranking)", () => {
  const r = buildExamCohort({ exam, attempts: [att("s1", all()), att("s2", { q1: "A", q2: "A" }), att("s3", { q1: "A", q2: "A" }), att("s4", {})] });
  assert.deepEqual(r.top.map((t) => t.rank), [1, 2, 2, 4]);
});

test("support list only for cohorts of 5+, only under the threshold", () => {
  const small = buildExamCohort({ exam, attempts: [att("s1", {}), att("s2", all())] });
  assert.deepEqual(small.support, []); assert.equal(small.limitedEvidence, true);
  const big = buildExamCohort({ exam, attempts: [att("s1", {}), att("s2", all()), att("s3", all()), att("s4", all()), att("s5", { q1: "A", q2: "A" })] });
  assert.equal(big.limitedEvidence, false); assert.deepEqual(big.support.map((s) => s.userId), ["s1"]);
});

test("question stats: percent correct, skipped and most chosen wrong option", () => {
  const r = buildExamCohort({ exam, attempts: [att("s1", { q1: "B" }), att("s2", { q1: "B" }), att("s3", { q1: "A" }), att("s4", {})] });
  const q1 = r.hardest.find((h) => h.questionId === "q1");
  assert.equal(q1.percentCorrect, 25); assert.equal(q1.skippedPercent, 25); assert.deepEqual(q1.mostChosenWrong, { key: "B", percent: 50 });
});

test("topics: untagged excluded, marks-weighted", () => {
  const r = buildExamCohort({ exam, attempts: [att("s1", { q1: "A", q2: "B", q3: "A" }), att("s2", { q1: "A", q2: "A" })] });
  assert.equal(r.topics.find((t) => t.topic === "Algebra").percentage, 75);
  assert.equal(r.topics.find((t) => t.topic === "Untagged"), undefined);
});

test("exam edited after attempts: scores kept, question level excluded", () => {
  const edited = { ...exam, questions: exam.questions.slice(0, 3) };
  const r = buildExamCohort({ exam: edited, attempts: [att("s1", all())] });
  assert.equal(r.participants, 1); assert.equal(r.questionBasis.unverifiable, 1); assert.deepEqual(r.hardest, []);
});

test("auto-submitted attempts counted and reported", () => {
  const r = buildExamCohort({ exam, attempts: [att("s1", {}, { autoSubmitted: true })] });
  assert.equal(r.autoSubmitted, 1); assert.equal(r.participants, 1);
});

test("nothing identifying beyond ids, and no answer keys or explanations", () => {
  const withKey = { ...exam, questions: exam.questions.map((x) => ({ ...x, explanation: "SECRET" })) };
  const json = JSON.stringify(buildExamCohort({ exam: withKey, attempts: [att("s1", { q1: "B" })] }));
  assert.ok(!json.includes("correctKey")); assert.ok(!json.includes("SECRET"));
});
