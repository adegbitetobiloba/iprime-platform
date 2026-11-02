// Exam countdown and a simple pacing plan. Pure, so the numbers can be tested.
const DAY = 24 * 60 * 60 * 1000;

// Whole days from now until the target instant (rounded up, so "1" means the exam is within 24 hours). Never negative.
function daysLeft(targetIso, nowMs = Date.now()) {
  const t = new Date(targetIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - nowMs) / DAY));
}

// Spreads the lessons a student has left over the weeks that remain. Returns null when there is nothing to plan.
function studyPlan(days, lessonsRemaining) {
  if (days === null || days === undefined || !(lessonsRemaining >= 0)) return null;
  const weeks = Math.max(1, Math.floor(days / 7));
  return { daysLeft: days, weeksLeft: Math.floor(days / 7), lessonsRemaining, lessonsPerWeek: lessonsRemaining === 0 ? 0 : Math.ceil(lessonsRemaining / weeks), enoughTime: days >= 7 };
}
module.exports = { daysLeft, studyPlan };
