// Offline-safe submission. A student who loses their connection keeps answering on their device. When the
// connection returns they send everything in one request, and the server decides what may still count.
//
// The rules (all enforced here on the server, never trusted from the browser):
//   - "open"  : before the deadline. Everything sent is accepted, as with normal saving.
//   - "grace" : after the deadline but before closeAt (deadline + the reconnection grace period). Only answers the
//               device says were given BEFORE the deadline are accepted. The device's timestamps cannot be proven, so
//               the window is short and an attempt that used it is flagged (lateSynced) for review.
//   - "ended" : after closeAt. Nothing more is accepted; the attempt is closed with what the server already had.
const { servedQuestions } = require("./randomise");

const GRACE_MAX_SECONDS = 60 * 60;
const TOLERANCE_MS = 5000; // allowance for clock rounding between device and server

// EXAM_RECONNECT_GRACE_MINUTES: default 10. 0 switches the grace period off. Capped at 60.
function graceSecondsFromEnv(env = process.env) {
  const raw = env.EXAM_RECONNECT_GRACE_MINUTES;
  const m = raw === undefined || raw === "" ? 10 : Number(raw);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.min(Math.round(m * 60), GRACE_MAX_SECONDS);
}

const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const deadlineMs = (a) => ms(a.deadline);
const closeAtMs = (a) => ms(a.closeAt || a.deadline); // attempts created before this existed have no grace

function phaseOf(attempt, now = Date.now()) {
  if (attempt.pausedAt) return "open"; // an administrator paused the exam: the clock is stopped
  const t = ms(now);
  if (t < deadlineMs(attempt)) return "open";
  if (t < closeAtMs(attempt)) return "grace";
  return "ended";
}

// Works out what to apply. Pure: no database.
function planSync(attempt, exam, entries, now = Date.now()) {
  const t = ms(now);
  const phase = phaseOf(attempt, t);
  const out = { phase, update: null, accepted: 0, rejected: [] };
  if (phase === "ended") return out;

  const served = new Map(servedQuestions(exam, attempt).map((q) => [String(q._id), q]));
  const startedAt = ms(attempt.startedAt);
  const ok = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    const q = served.get(String(e && e.questionId));
    if (!q) { out.rejected.push({ questionId: e && e.questionId, reason: "unknown_question" }); continue; }
    if (e.choice && !q.options.some((o) => o.key === e.choice)) { out.rejected.push({ questionId: e.questionId, reason: "unknown_option" }); continue; }
    const at = e.answeredAt === undefined || e.answeredAt === null ? NaN : ms(e.answeredAt);
    if (phase === "grace") {
      if (!Number.isFinite(at)) { out.rejected.push({ questionId: e.questionId, reason: "no_timestamp" }); continue; }
      if (at > deadlineMs(attempt) + TOLERANCE_MS) { out.rejected.push({ questionId: e.questionId, reason: "after_deadline" }); continue; }
      if (at < startedAt - TOLERANCE_MS) { out.rejected.push({ questionId: e.questionId, reason: "before_start" }); continue; }
    }
    ok.push({ ...e, at: Number.isFinite(at) ? at : 0 });
  }
  if (!ok.length) return out;

  ok.sort((a, b) => a.at - b.at); // the latest change to a question wins
  const answers = new Map(); // qid -> key | null
  const flags = new Map();   // qid -> boolean
  for (const e of ok) {
    if (e.choice !== undefined) answers.set(String(e.questionId), e.choice);
    if (e.flagged !== undefined) flags.set(String(e.questionId), Boolean(e.flagged));
  }

  const $set = {};
  const $unset = {};
  for (const [qid, key] of answers) { if (key === null) $unset[`answers.${qid}`] = ""; else $set[`answers.${qid}`] = key; }
  if (flags.size) {
    const f = new Set((attempt.flagged || []).map(String));
    for (const [qid, on] of flags) { if (on) f.add(qid); else f.delete(qid); }
    $set.flagged = [...f];
  }
  if (phase === "grace") {
    $set.lateSynced = true;
    $set.lateSyncedAt = new Date(t);
    $set.lateSyncedCount = ok.length;
    $set.lateSyncRejected = out.rejected.length;
  }
  out.update = { $inc: { rev: 1 }, ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) };
  out.accepted = ok.length;
  return out;
}

// sync(attempt, exam, entries): applies what is allowed, then closes the attempt (scoring from what is now stored).
function makeSyncer({ Attempt, finalise }) {
  return async function sync(attempt, exam, entries, now = new Date()) {
    if (attempt.status === "submitted") return { outcome: "already_submitted", attempt, accepted: 0, rejected: [] };
    const t = ms(now);
    const plan = planSync(attempt, exam, entries, t);
    if (plan.update) {
      const r = await Attempt.updateOne({ _id: attempt._id, status: "in_progress" }, plan.update);
      if (r.matchedCount === 0) {
        const cur = await Attempt.findById(attempt._id).lean(); // closed by someone else a moment ago
        return { outcome: "already_submitted", attempt: cur, accepted: 0, rejected: plan.rejected };
      }
    }
    const fresh = await Attempt.findById(attempt._id).lean();
    // If an administrator asked this student's screen to submit, record that as the reason.
    const reason = fresh && fresh.adminCommand && fresh.adminCommand.type === "submit" ? "admin_forced" : undefined;
    const done = await finalise(fresh, exam, t >= deadlineMs(attempt), reason);
    return { outcome: plan.phase === "ended" ? "grace_ended" : "closed", attempt: done, accepted: plan.accepted, rejected: plan.rejected };
  };
}

module.exports = { graceSecondsFromEnv, phaseOf, planSync, makeSyncer, closeAtMs, TOLERANCE_MS, GRACE_MAX_SECONDS };
