// Closes attempts that are past their closing time even if the student never comes back (closed tab, dead battery).
// "Closing time" is the deadline plus the reconnection grace period (see utils/lateSync.js), so a student who is
// offline still has the chance to send their answers. Attempts created before the grace period existed have no
// closeAt and close at the deadline, as before.
// NOTE: on Render's free plan the service sleeps when idle; the sweep only runs while it is awake. The
// close-on-access checks in examController remain the safety net.

function makeSweeper({ Attempt, Exam, finalise, log = console }) {
  let running = false;
  const bad = new Set(); // attempts that cannot be closed (e.g. their exam was deleted): skipped so they never block others

  return async function sweep(now = new Date(), batch = 50) {
    if (running) return { skipped: true };
    running = true;
    try {
      const due = await Attempt.find({
        status: "in_progress",
        _id: { $nin: [...bad] },
        $or: [{ closeAt: { $lte: now } }, { closeAt: { $exists: false }, deadline: { $lte: now } }],
      })
        .sort({ deadline: 1 })
        .limit(batch)
        .lean();
      let closed = 0, failed = 0;
      for (const a of due) {
        try {
          const exam = await Exam.findById(a.examId).lean();
          if (!exam) { bad.add(a._id); failed++; log.error(`[sweeper] exam missing for attempt ${a._id}`); continue; }
          const done = await finalise(a, exam, true);
          if (done && done.status === "submitted") closed++; else failed++;
        } catch (err) {
          failed++;
          log.error(`[sweeper] attempt ${a._id}: ${err.message}`);
        }
      }
      return { found: due.length, closed, failed };
    } finally {
      running = false;
    }
  };
}

// EXAM_SWEEP_SECONDS: how often to sweep (default 60). Set to 0 to switch the sweeper off.
function startSweeper() {
  const secs = Number(process.env.EXAM_SWEEP_SECONDS ?? 60);
  if (!(secs > 0)) return null;
  const Attempt = require("../models/Attempt");
  const Exam = require("../models/Exam");
  const AttemptEvent = require("../models/AttemptEvent");
  const { makeFinaliser } = require("./attemptLifecycle");
  const { makeLogger } = require("./attemptEvents");
  const logger = makeLogger(AttemptEvent);
  const finalise = makeFinaliser(Attempt, { onClosed: (a, info) => logger.log(a, "auto_submitted_time", { reason: info.reason, by: "sweeper" }) });
  const sweep = makeSweeper({ Attempt, Exam, finalise });
  const run = () => sweep().then((r) => { if (r && r.found) console.log(`[sweeper] ${JSON.stringify(r)}`); }).catch((e) => console.error("[sweeper]", e.message));
  setTimeout(run, 5000).unref();
  return setInterval(run, secs * 1000).unref();
}

module.exports = { makeSweeper, startSweeper };
