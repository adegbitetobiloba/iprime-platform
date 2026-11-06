// Per-student question draws. The exam's questions are a POOL; if the exam sets `questionsPerStudent` (N), each student
// gets their own N questions drawn from it when they start. Pure logic (no database) plus one small planner.
//
// What is guaranteed:
//  - The draw is made once, on the server, when the attempt starts, and saved on the attempt (`questionIds`). Refresh,
//    resume and a second device show the same questions; scoring and review use only those questions.
//  - A student never gets the same question twice in one attempt.
//  - Questions are SPREAD: each new student gets the least-used questions first, so papers are completely different
//    until the pool is used up, and are then recycled evenly. (Two students starting at the very same instant can overlap.)
//  - Retakes prefer questions the student has NOT seen in an earlier attempt of this exam.
//  - If N is bigger than the pool, the student simply gets the whole pool (never an error, never padding).
// Completely disjoint papers need a pool of at least N x (number of students); beyond that, reuse is unavoidable but even.
// With spreading switched off, draws are independent and overlap is N*N/pool on average; see expectedOverlap().
const { selectQuestions } = require("./selection");
const { newSeed, servedQuestions } = require("./randomise");

const MAX_PER_STUDENT = 500;
const perStudent = (exam) => {
  const n = Math.floor(Number(exam && exam.questionsPerStudent));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_PER_STUDENT) : null;
};

// On average, how many questions two students' papers share: N*N/P for random draws (P = pool size).
const expectedOverlap = (n, pool) => (pool > 0 ? (Math.min(n, pool) * Math.min(n, pool)) / pool : 0);

// usage: { questionId: how many attempts of this exam were already given that question }. With "spread" on (the default)
// the least-used questions are handed out first, so students' papers stay completely different until the pool has
// been used up, then questions are recycled evenly. seenIds: questions THIS student already had in an earlier attempt;
// they go last, so a retake gets fresh questions whenever the pool allows it.
const SEEN_PENALTY = 1e6;
function drawQuestionIds(exam, { seed, seenIds = [], usage = {} } = {}) {
  const pool = (exam.questions || []).map((q) => ({ id: String(q._id), topic: q.topic || "", subject: q.subject || "", difficulty: q.difficulty || null }));
  const n = perStudent(exam);
  if (!n || n >= pool.length) return null; // everyone gets everything
  const subjects = new Set(pool.map((p) => p.subject).filter(Boolean));
  const cost = {};
  for (const p of pool) cost[p.id] = (exam.drawSpread === false ? 0 : usage[p.id] || 0);
  for (const id of seenIds.map(String)) if (id in cost) cost[id] += SEEN_PENALTY;
  const res = selectQuestions(pool, {
    count: n, seed, balanceTopics: exam.drawBalance !== false, balanceBy: subjects.size > 1 ? "subject" : "topic",
    difficulty: exam.drawMixDifficulty ? { mode: "mix" } : { mode: "any" }, cost,
  });
  return res.picked.map((q) => q.id);
}

// How often each question has been handed out in this exam, and which ones THIS student has already had.
// On a real database this is ONE grouped query (a count per question, so at most pool-size rows come back) plus the
// student's own few attempts. The earlier way pulled every attempt of the exam into memory on every start, which got
// slower with every student who had started. Anything without aggregate() (a test stand-in) uses the earlier way.
async function loadUsage(Attempt, examId, userId) {
  const usage = {}, seenIds = [];
  if (typeof Attempt.aggregate === "function") {
    const rows = (await Attempt.aggregate([
      { $match: { examId, questionIds: { $exists: true, $ne: [] } } },
      { $unwind: "$questionIds" },
      { $group: { _id: "$questionIds", n: { $sum: 1 } } },
    ])) || [];
    for (const r of rows) usage[r._id] = r.n;
    const mine = (await Attempt.find({ examId, userId }).select("questionIds").lean()) || [];
    for (const a of mine) for (const id of a.questionIds || []) seenIds.push(id);
    return { usage, seenIds };
  }
  const all = (await Attempt.find({ examId }).select("userId questionIds").lean()) || [];
  for (const a of all) for (const id of a.questionIds || []) { usage[id] = (usage[id] || 0) + 1; if (String(a.userId) === String(userId)) seenIds.push(id); }
  return { usage, seenIds };
}

// Everything a new attempt needs to be created with. `Attempt` is the model (only used to look at earlier attempts).
async function planAttempt(Attempt, exam, userId) {
  const seed = newSeed();
  const plan = { seed, shuffleQuestions: Boolean(exam.shuffleQuestions), shuffleOptions: Boolean(exam.shuffleOptions) };
  if (perStudent(exam)) {
    const { usage, seenIds } = await loadUsage(Attempt, exam._id, userId);
    const ids = drawQuestionIds(exam, { seed, seenIds, usage });
    if (ids) plan.questionIds = ids;
  }
  return plan;
}

// What a student is told before starting: how many questions and how many marks THEY will get. shapeFromTotals does the
// arithmetic from a pool size and the pool's total marks, so a list page can use it without loading every question.
function shapeFromTotals(exam, poolSize, sum) {
  const n = perStudent(exam);
  const count = n ? Math.min(n, poolSize) : poolSize;
  const totalMarks = n && n < poolSize ? Math.round((sum / (poolSize || 1)) * count * 100) / 100 : sum;
  return { questionCount: count, totalMarks, poolSize, drawn: Boolean(n && n < poolSize) };
}
function shape(exam) {
  const all = (exam && exam.questions) || [];
  return shapeFromTotals(exam, all.length, all.reduce((t, q) => t + (q.marks ?? 1), 0));
}

module.exports = { perStudent, expectedOverlap, drawQuestionIds, loadUsage, planAttempt, shape, shapeFromTotals, servedQuestions };
