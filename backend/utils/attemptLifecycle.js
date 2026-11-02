// Closing an attempt (scoring + marking it submitted). Kept free of Express and of a direct database
// import so it can be tested with a fake Attempt model.
const { scoreAttempt } = require("./cbt");
const { servedQuestions } = require("./randomise");

const MAX_TRIES = 5;

// Every saved answer bumps attempt.rev. We score from a snapshot and close the attempt ONLY if rev has not
// moved since that snapshot. If a save landed in between, we re-read and score again, so the stored score
// always matches the stored answers.
//
// finalise(attempt, exam, auto, reason): `reason` is stored as submitReason ("student", "time_up", "violation_limit", ...).
// onClosed(attempt, { auto, reason }) runs once, only for the call that actually closed it (used to write the activity log).
function makeFinaliser(Attempt, { onClosed } = {}) {
  return async function finalise(attempt, exam, auto, reason) {
    let current = attempt;
    for (let i = 0; i < MAX_TRIES; i++) {
      if (!current) return null;
      if (current.status === "submitted") return current; // already closed: same stored result, no re-scoring
      const served = servedQuestions(exam, current); // only the questions this student was given (the whole exam if there is no draw)
      const result = scoreAttempt(served, current.answers);
      const revFilter = current.rev == null ? { $exists: false } : current.rev; // attempts created before rev existed
      const why = reason || (auto ? "time_up" : "student");
      const r = await Attempt.updateOne(
        { _id: current._id, status: "in_progress", rev: revFilter },
        { $set: { status: "submitted", submittedAt: new Date(), autoSubmitted: Boolean(auto), submitReason: why, questionCount: served.length, ...result } }
      );
      if (r.matchedCount === 1) {
        const done = await Attempt.findById(current._id).lean();
        if (onClosed) { try { await onClosed(done, { auto: Boolean(auto), reason: why }); } catch (e) { /* the log must never stop a submission */ } }
        return done;
      }
      current = await Attempt.findById(current._id).lean(); // someone saved or closed it first: look again
    }
    throw new Error("Could not close the attempt because it kept changing. Please try again.");
  };
}

module.exports = { makeFinaliser, MAX_TRIES };
