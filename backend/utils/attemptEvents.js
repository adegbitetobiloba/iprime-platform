// The exam activity log and the violation counter. The server decides what counts; the browser only reports.
const { normalizePolicy, classify } = require("./guard");
const { phaseOf } = require("./lateSync");

const MAX_EVENTS_PER_ATTEMPT = 1500; // stops a misbehaving browser filling the database; counted violations are always stored

// Server-side entries (started, resumed, submitted, ...). Never throws: logging must not break an exam.
function makeLogger(AttemptEvent) {
  return {
    async log(attempt, type, meta) {
      try {
        await AttemptEvent.create({ attemptId: attempt._id, examId: attempt.examId, userId: attempt.userId, type, source: "server", at: new Date(), ...(meta ? { meta } : {}) });
      } catch (e) { console.error("[events]", e.message); }
    },
  };
}

function makeEventService({ Attempt, AttemptEvent, finalise }) {
  return {
    // events: validated list from the browser. Returns the state the exam screen needs to show a warning.
    async ingest(attempt, exam, events, now = new Date()) {
      const policy = normalizePolicy(attempt.guard || exam.guard); // the policy fixed when the attempt began
      const max = policy.maxViolations;
      if (attempt.status !== "in_progress") return { closed: true, violations: attempt.violations || 0, max };
      const phase = phaseOf(attempt, now);
      if (phase === "ended") return { closed: false, ignored: true, violations: attempt.violations || 0, max };

      const stored = await AttemptEvent.countDocuments({ attemptId: attempt._id });
      let counted = 0;
      let n = 0;
      for (const evt of events) {
        const c = phase === "open" && !attempt.pausedAt ? classify(evt, policy) : false; // after the deadline, or while paused, events are only logged, never counted
        if (!c && stored + n >= MAX_EVENTS_PER_ATTEMPT) continue;
        try {
          const r = await AttemptEvent.updateOne(
            { attemptId: attempt._id, eid: evt.eid },
            { $setOnInsert: {
              attemptId: attempt._id, examId: attempt.examId, userId: attempt.userId, type: evt.type, source: "client", eid: evt.eid,
              at: now, ...(evt.at ? { clientAt: new Date(evt.at) } : {}), ...(Number.isFinite(evt.durationMs) ? { durationMs: evt.durationMs } : {}),
              counted: c, ...(evt.reasons && evt.reasons.length ? { meta: { reasons: evt.reasons } } : {}),
            } },
            { upsert: true }
          );
          if (r.upsertedCount === 1) { n++; if (c) counted++; } // a resent event (same eid) is not counted again
        } catch (e) {
          if (e.code !== 11000) throw e; // 11000 = the same event arrived twice at once
        }
      }

      let violations = attempt.violations || 0;
      if (counted > 0) {
        const upd = await Attempt.findOneAndUpdate({ _id: attempt._id, status: "in_progress" }, { $inc: { violations: counted } }, { returnDocument: "after" }).lean();
        if (!upd) return { closed: true, violations, max }; // it was closed while we were counting
        violations = upd.violations;
      }
      if (counted > 0 && policy.autoSubmit && violations >= max) {
        const fresh = await Attempt.findById(attempt._id).lean();
        const done = await finalise(fresh, exam, true, "violation_limit");
        return { closed: true, terminated: true, violations, max, attempt: done };
      }
      return { closed: false, violations, max, remaining: Math.max(0, max - violations), counted };
    },
  };
}

module.exports = { makeLogger, makeEventService, MAX_EVENTS_PER_ATTEMPT };
