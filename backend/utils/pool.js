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

// Everything a new attempt needs to be created with. `Attempt` is the model (only used to look at earlier attempts).
async function planAttempt(Attempt, exam, userId) {
  const seed = newSeed();
  const plan = { seed, shuffleQuestions: Boolean(exam.shuffleQuestions), shuffleOptions: Boolean(exam.shuffleOptions) };
  if (perStudent(exam)) {
    const all = (await Attempt.find({ examId: exam._id }).select("userId questionIds").lean()) || [];
    const usage = {}, seenIds = [];
    for (const a of all) for (const id of a.questionIds || []) { usage[id] = (usage[id] || 0) + 1; if (String(a.userId) === String(userId)) seenIds.push(id); }
    const ids = drawQuestionIds(exam, { seed, seenIds, usage });
    if (ids) plan.questionIds = ids;
  }
  return plan;
}

// What a student is told before starting: how many questions and how many marks THEY will get.
function shape(exam) {
  const all = (exam && exam.questions) || [];
  const n = perStudent(exam);
  const count = n ? Math.min(n, all.length) : all.length;
  const sum = all.reduce((t, q) => t + (q.marks ?? 1), 0);
  const totalMarks = n && n < all.length ? Math.round((sum / (all.length || 1)) * count * 100) / 100 : sum;
  return { questionCount: count, totalMarks, poolSize: all.length, drawn: Boolean(n && n < all.length) };
}

module.exports = { perStudent, expectedOverlap, drawQuestionIds, planAttempt, shape, servedQuestions };
