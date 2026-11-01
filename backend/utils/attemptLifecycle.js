// Closing an attempt (scoring + marking it submitted). Kept free of Express and of a direct database
// import so it can be tested with a fake Attempt model.
const { scoreAttempt } = require("./cbt");

const MAX_TRIES = 5;

// Every saved answer bumps attempt.rev. We score from a snapshot and close the attempt ONLY if rev has not
// moved since that snapshot. If a save landed in between, we re-read and score again, so the stored score
// always matches the stored answers.
function makeFinaliser(Attempt) {
  return async function finalise(attempt, exam, auto) {
    let current = attempt;
    for (let i = 0; i < MAX_TRIES; i++) {
      if (!current) return null;
      if (current.status === "submitted") return current; // already closed: same stored result, no re-scoring
      const result = scoreAttempt(exam.questions, current.answers);
      const revFilter = current.rev == null ? { $exists: false } : current.rev; // attempts created before rev existed
      const r = await Attempt.updateOne(
        { _id: current._id, status: "in_progress", rev: revFilter },
        { $set: { status: "submitted", submittedAt: new Date(), autoSubmitted: Boolean(auto), questionCount: exam.questions.length, ...result } }
      );
      if (r.matchedCount === 1) return Attempt.findById(current._id).lean();
      current = await Attempt.findById(current._id).lean(); // someone saved or closed it first: look again
    }
    throw new Error("Could not close the attempt because it kept changing. Please try again.");
  };
}

module.exports = { makeFinaliser, MAX_TRIES };
