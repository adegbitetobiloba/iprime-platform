// ExamControl: what an administrator can do to a running attempt, and how a running attempt is classified for the live
// view. Each action is one guarded database update, so two administrators clicking at once cannot corrupt an attempt, and
// every action is written to the activity log with who did it. No Express here; the models are passed in.
const { phaseOf } = require("./lateSync");

const ACTIVE_SECONDS = 60;      // heard from the student's screen within this: "connected"
const QUIET_SECONDS = 180;      // within this: "quiet"; beyond it: "disconnected"
const MAX_EXTEND_MINUTES = 120; // per action
const MAX_EXTRA_SECONDS = 4 * 3600; // in total, per attempt

const ms = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

// The newest sign of life: a check-in, a saved answer, or the start.
function lastSignalMs(a) {
  const t = [a.lastSeenAt, a.lastSavedAt, a.startedAt].map((x) => (x ? ms(x) : NaN)).filter(Number.isFinite);
  return t.length ? Math.max(...t) : NaN;
}

function connectionOf(attempt, now = Date.now()) {
  if (attempt.pausedAt) return "paused";
  const last = lastSignalMs(attempt);
  if (!Number.isFinite(last)) return "disconnected";
  const age = (ms(now) - last) / 1000;
  return age <= ACTIVE_SECONDS ? "online" : age <= QUIET_SECONDS ? "quiet" : "disconnected";
}

// Time left in seconds. A paused attempt shows the time that was left when it was paused.
function remainingSeconds(attempt, now = Date.now()) {
  const ref = attempt.pausedAt ? ms(attempt.pausedAt) : ms(now);
  return Math.max(0, Math.ceil((ms(attempt.deadline) - ref) / 1000));
}

function makeControl({ Attempt, finalise, logger }) {
  const note = (a, type, meta) => logger.log(a, type, meta);
  const running = (a) => a.status === "in_progress";

  return {
    async pause(attempt, adminId, reason, now = new Date()) {
      if (!running(attempt)) return { ok: false, code: "NOT_RUNNING" };
      if (attempt.pausedAt) return { ok: false, code: "ALREADY_PAUSED" };
      if (phaseOf(attempt, now) !== "open") return { ok: false, code: "TIME_UP" };
      const r = await Attempt.updateOne(
        { _id: attempt._id, status: "in_progress", pausedAt: null, deadline: { $gt: now } },
        { $set: { pausedAt: now }, $inc: { pauseCount: 1 } }
      );
      if (r.matchedCount === 0) return { ok: false, code: "CHANGED" };
      note(attempt, "admin_paused", { by: String(adminId), ...(reason ? { reason } : {}) });
      return { ok: true };
    },

    // Gives back exactly the time that was left at the moment of the pause (and the same grace period).
    async resume(attempt, adminId, now = new Date()) {
      if (!running(attempt)) return { ok: false, code: "NOT_RUNNING" };
      if (!attempt.pausedAt) return { ok: false, code: "NOT_PAUSED" };
      const pausedMs = ms(attempt.pausedAt);
      const remainingMs = Math.max(0, ms(attempt.deadline) - pausedMs);
      const graceMs = Math.max(0, ms(attempt.closeAt || attempt.deadline) - ms(attempt.deadline));
      const deadline = new Date(ms(now) + remainingMs);
      const closeAt = new Date(deadline.getTime() + graceMs);
      const r = await Attempt.updateOne(
        { _id: attempt._id, status: "in_progress", pausedAt: new Date(pausedMs) },
        { $set: { deadline, closeAt, pausedAt: null }, $inc: { pausedTotalSeconds: Math.max(0, Math.round((ms(now) - pausedMs) / 1000)) } }
      );
      if (r.matchedCount === 0) return { ok: false, code: "CHANGED" };
      note(attempt, "admin_resumed", { by: String(adminId), secondsLeft: Math.round(remainingMs / 1000) });
      return { ok: true };
    },

    async extend(attempt, minutes, adminId, reason, now = new Date()) {
      const m = Number(minutes);
      if (!Number.isInteger(m) || m < 1 || m > MAX_EXTEND_MINUTES) return { ok: false, code: "BAD_MINUTES" };
      if (!running(attempt)) return { ok: false, code: "NOT_RUNNING" };
      if (!attempt.pausedAt && ms(now) >= ms(attempt.closeAt || attempt.deadline)) return { ok: false, code: "TIME_UP" }; // already closing
      if ((attempt.extraSeconds || 0) + m * 60 > MAX_EXTRA_SECONDS) return { ok: false, code: "LIMIT" };
      const add = m * 60000;
      const r = await Attempt.updateOne(
        { _id: attempt._id, status: "in_progress", deadline: new Date(ms(attempt.deadline)) },
        { $set: { deadline: new Date(ms(attempt.deadline) + add), closeAt: new Date(ms(attempt.closeAt || attempt.deadline) + add) }, $inc: { extraSeconds: m * 60 } }
      );
      if (r.matchedCount === 0) return { ok: false, code: "CHANGED" };
      note(attempt, "time_extended", { by: String(adminId), minutes: m, ...(reason ? { reason } : {}) });
      return { ok: true };
    },

    // Politely: the student's screen is told to submit at its next check-in, so answers still waiting on the device are sent first.
    async requestSubmit(attempt, adminId, reason, now = new Date()) {
      if (!running(attempt)) return { ok: false, code: "NOT_RUNNING" };
      const r = await Attempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { adminCommand: { type: "submit", at: new Date(ms(now)), by: String(adminId), ...(reason ? { reason } : {}) } } });
      if (r.matchedCount === 0) return { ok: false, code: "CHANGED" };
      note(attempt, "admin_force_requested", { by: String(adminId), ...(reason ? { reason } : {}) });
      return { ok: true };
    },

    // Immediately: scored with the answers the server already has. Anything still waiting on the student's device is lost.
    async closeNow(attempt, exam, adminId, kind, reason) {
      if (!running(attempt)) return { ok: false, code: "NOT_RUNNING" };
      const why = kind === "terminate" ? "admin_terminated" : "admin_forced";
      const fresh = await Attempt.findById(attempt._id).lean();
      const done = await finalise(fresh, exam, true, why);
      if (!done || done.status !== "submitted") return { ok: false, code: "CHANGED" };
      note(attempt, kind === "terminate" ? "admin_terminated" : "admin_force_submitted", { by: String(adminId), ...(reason ? { reason } : {}) });
      return { ok: true, attempt: done };
    },
  };
}

module.exports = { makeControl, connectionOf, remainingSeconds, lastSignalMs, ACTIVE_SECONDS, QUIET_SECONDS, MAX_EXTEND_MINUTES, MAX_EXTRA_SECONDS };
