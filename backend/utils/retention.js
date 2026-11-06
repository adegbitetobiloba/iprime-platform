// How long exam activity records (the per-attempt timeline: tab-away reports, pauses, and so on) are kept.
// Only these records are deleted. Attempts, answers, scores and results are never touched.
// This is a policy default for the owner to confirm (see the brief: "state purpose and retention").
const DEFAULT_DAYS = 365;
const MAX_DAYS = 3650;

// EXAM_EVENT_RETENTION_DAYS: default 365; 0 (or anything not a positive number) keeps records forever; capped at 10 years.
function retentionDays(env = process.env) {
  const raw = env.EXAM_EVENT_RETENTION_DAYS;
  if (raw === undefined || raw === "") return DEFAULT_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), MAX_DAYS);
}

async function purgeOldEvents(AttemptEvent, days, now = new Date()) {
  if (!days) return { deleted: 0, skipped: true };
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const r = await AttemptEvent.deleteMany({ at: { $lt: cutoff } });
  return { deleted: (r && r.deletedCount) || 0, cutoff };
}

module.exports = { retentionDays, purgeOldEvents, DEFAULT_DAYS, MAX_DAYS };
