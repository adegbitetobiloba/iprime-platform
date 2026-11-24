// Copy of rankFirstAttempts from backend/utils/cohortAnalytics.js (main, 7 Nov 2026), used so tests run the SAME ranking rules.
const idOf = (v) => (v == null ? "" : String(v));
const toMs = (v) => (v ? new Date(v).getTime() : NaN);
function rankFirstAttempts(attempts = []) {
  const submitted = attempts.filter((a) => a.status === "submitted" || a.submittedAt).sort((a, b) => toMs(a.submittedAt) - toMs(b.submittedAt));
  const firstByStudent = new Map();
  const countByStudent = new Map();
  for (const a of submitted) {
    const u = idOf(a.userId);
    countByStudent.set(u, (countByStudent.get(u) || 0) + 1);
    if (!firstByStudent.has(u)) firstByStudent.set(u, a);
  }
  const firsts = [...firstByStudent.values()];
  const ordered = [...firsts].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0) || toMs(a.submittedAt) - toMs(b.submittedAt));
  let lastPct = null, lastRank = 0;
  const ranking = ordered.map((a, i) => {
    const pct = a.percentage ?? 0;
    const rank = pct === lastPct ? lastRank : i + 1;
    lastPct = pct; lastRank = rank;
    return { userId: idOf(a.userId), attemptId: idOf(a._id ?? a.id), rank, percentage: pct, autoSubmitted: Boolean(a.autoSubmitted) };
  });
  return { submitted, firsts, countByStudent, ranking };
}
module.exports = { rankFirstAttempts };
