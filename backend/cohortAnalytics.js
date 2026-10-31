// Per-examination cohort analytics for staff (workstream 2, milestone 3). Pure functions, no database.
// Rules (also in docs/ANALYTICS.md):
//  - Basis: each student's FIRST submitted attempt at the exam, so retakes do not inflate the cohort figures.
//    Retakers are counted separately.
//  - Only students who submitted are in the data. "Absent" cannot be known until the Admin workstream provides
//    class/enrolment lists, so absentees are NOT counted as zero and participation is not shown as a percentage.
//  - Scores come from the stored result. Question-level figures use only attempts that re-grade to the stored result.
//  - Ties share a rank (competition ranking: 1, 2, 2, 4).
//  - Fewer than MIN_COHORT students: results are flagged limitedEvidence and no support list is produced.
const { scoreAttempt, toPlain } = require("./cbt");

const round1 = (n) => Math.round(n * 10) / 10;
const idOf = (v) => (v == null ? "" : String(v));
const toMs = (v) => (v ? new Date(v).getTime() : NaN);

const MIN_COHORT = 5;       // smallest group we describe in any way beyond raw counts
const SUPPORT_BELOW = 40;   // percentage under which a learner is listed for a check-in
const UNTAGGED = "Untagged";

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return round1(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

function buildExamCohort({ exam, attempts = [] }) {
  const questions = exam?.questions || [];
  const submitted = attempts.filter((a) => a.status === "submitted" || a.submittedAt).sort((a, b) => toMs(a.submittedAt) - toMs(b.submittedAt));

  const firstByStudent = new Map();
  const countByStudent = new Map();
  for (const a of submitted) {
    const u = idOf(a.userId);
    countByStudent.set(u, (countByStudent.get(u) || 0) + 1);
    if (!firstByStudent.has(u)) firstByStudent.set(u, a);
  }
  const firsts = [...firstByStudent.values()];
  const participants = firsts.length;
  const limitedEvidence = participants < MIN_COHORT;

  const pcts = firsts.map((a) => a.percentage ?? 0).sort((a, b) => a - b);
  const mean = participants ? round1(pcts.reduce((s, n) => s + n, 0) / participants) : null;
  const stats = { mean, median: quantile(pcts, 0.5), q1: quantile(pcts, 0.25), q3: quantile(pcts, 0.75), min: participants ? pcts[0] : null, max: participants ? pcts[pcts.length - 1] : null };

  // ten bands: 0-9.9, 10-19.9, ... 90-100 (100 belongs to the top band)
  const distribution = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9.9, count: 0 }));
  for (const p of pcts) distribution[Math.min(9, Math.floor(p / 10))].count += 1;

  // ranking with shared ranks for ties
  const ordered = [...firsts].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0) || toMs(a.submittedAt) - toMs(b.submittedAt));
  let lastPct = null, lastRank = 0;
  const ranking = ordered.map((a, i) => {
    const pct = a.percentage ?? 0;
    const rank = pct === lastPct ? lastRank : i + 1;
    lastPct = pct; lastRank = rank;
    return { userId: idOf(a.userId), attemptId: idOf(a._id ?? a.id), rank, percentage: pct, autoSubmitted: Boolean(a.autoSubmitted) };
  });
  const top = ranking.filter((r) => r.rank <= 10);

  // question level, from verified first attempts only
  const verified = [];
  let unverifiable = 0;
  for (const a of firsts) {
    const r = questions.length ? scoreAttempt(questions, a.answers) : null;
    const same = r && r.score === a.score && r.totalMarks === a.totalMarks && r.correct === a.correct && r.incorrect === a.incorrect && r.unanswered === a.unanswered;
    if (same) verified.push(a); else unverifiable += 1;
  }

  const qRows = questions.map((q) => ({ q, id: idOf(q._id), right: 0, skipped: 0, wrong: {} }));
  const topicAgg = new Map();
  for (const a of verified) {
    const given = toPlain(a.answers);
    for (const row of qRows) {
      const choice = given[row.id];
      const marks = row.q.marks ?? 1;
      const isRight = Boolean(choice) && choice === row.q.correctKey;
      if (isRight) row.right += 1; else if (!choice) row.skipped += 1; else row.wrong[choice] = (row.wrong[choice] || 0) + 1;
      const topic = row.q.topic?.trim() || UNTAGGED;
      const t = topicAgg.get(topic) || { topic, earned: 0, available: 0, students: new Set(), questions: new Set() };
      t.earned += isRight ? marks : 0; t.available += marks; t.students.add(idOf(a.userId)); t.questions.add(row.id);
      topicAgg.set(topic, t);
    }
  }
  const n = verified.length;
  const questionStats = n ? qRows.map((r) => {
    const wrongEntries = Object.entries(r.wrong).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      questionId: r.id, text: r.q.text, topic: r.q.topic?.trim() || null,
      percentCorrect: round1((r.right / n) * 100), skippedPercent: round1((r.skipped / n) * 100),
      mostChosenWrong: wrongEntries.length ? { key: wrongEntries[0][0], percent: round1((wrongEntries[0][1] / n) * 100) } : null,
    };
  }) : [];
  const hardest = [...questionStats].sort((a, b) => a.percentCorrect - b.percentCorrect || a.text.localeCompare(b.text)).slice(0, 10);
  const topics = [...topicAgg.values()].filter((t) => t.topic !== UNTAGGED)
    .map((t) => ({ topic: t.topic, percentage: t.available ? round1((t.earned / t.available) * 100) : 0, questions: t.questions.size, students: t.students.size }))
    .sort((a, b) => a.percentage - b.percentage || a.topic.localeCompare(b.topic));

  const support = limitedEvidence ? [] : ranking.filter((r) => r.percentage < SUPPORT_BELOW).map(({ userId, attemptId, percentage }) => ({ userId, attemptId, percentage }));

  return {
    exam: { id: idOf(exam?._id ?? exam?.id), title: exam?.title || "Examination", subject: exam?.subject || null, questionCount: questions.length },
    basis: "first submitted attempt per student",
    definitions: { minCohort: MIN_COHORT, supportBelow: SUPPORT_BELOW },
    limitedEvidence,
    participants,
    attemptsTotal: submitted.length,
    retakers: [...countByStudent.values()].filter((c) => c > 1).length,
    autoSubmitted: firsts.filter((a) => a.autoSubmitted).length,
    stats, distribution, top, support,
    questionBasis: { verifiedStudents: n, unverifiable },
    hardest, topics,
  };
}

module.exports = { buildExamCohort, quantile, MIN_COHORT, SUPPORT_BELOW };
