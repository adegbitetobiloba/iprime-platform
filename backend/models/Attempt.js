const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    startedAt: { type: Date, required: true },
    deadline: { type: Date, required: true }, // fixed by the server at start; the countdown is derived from this
    // End of the reconnection grace period (deadline + graceSeconds), fixed at start. Until then an offline student may
    // still send answers they gave before the deadline. Older attempts have none and end at the deadline.
    closeAt: { type: Date },
    graceSeconds: { type: Number, default: 0 },
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    // Set when answers arrived after the deadline through the grace period. Their timestamps come from the student's
    // device and cannot be proven, so staff can review these attempts.
    lateSynced: { type: Boolean, default: false },
    lateSyncedAt: { type: Date },
    lateSyncedCount: { type: Number },
    lateSyncRejected: { type: Number },
    // ExamGuard: the security policy fixed when the attempt began (editing the exam later never changes a running attempt),
    // the number of violations the server has counted, and why/how it ended.
    guard: { type: mongoose.Schema.Types.Mixed },
    violations: { type: Number, default: 0 },
    submitReason: { type: String, maxlength: 40 }, // "student", "time_up", "violation_limit", ...
    saveCount: { type: Number, default: 0 },       // how many answer saves the server accepted
    lastSavedAt: { type: Date },
    // ExamControl: live administration. lastSeenAt is the last time the student's screen checked in (every ~20 s).
    // While pausedAt is set the clock is frozen; resuming gives back exactly the time that was left.
    lastSeenAt: { type: Date },
    pausedAt: { type: Date, default: null },
    pauseCount: { type: Number, default: 0 },
    pausedTotalSeconds: { type: Number, default: 0 },
    extraSeconds: { type: Number, default: 0 },    // minutes an administrator added, in seconds
    adminCommand: { type: mongoose.Schema.Types.Mixed }, // e.g. { type: "submit", at, by, reason }: delivered to the student's screen at its next check-in
    totalQuestions: { type: Number },              // how many questions this student was given
    seed: { type: String }, 
    questionIds: { type: [String], default: undefined },
    shuffleQuestions: { type: Boolean, default: false }, 
    shuffleOptions: { type: Boolean, default: false },
    answers: { type: Map, of: String, default: () => ({}) }, // questionId -> option key
    flagged: { type: [String], default: [] },                // questionIds marked for review
    // Bumped by every saved answer. Closing an attempt checks it, so a score can never be computed from
    // answers that changed while it was being calculated. Older attempts have no rev; that is handled.
    rev: { type: Number, default: 0 },
    // Filled by the server when the attempt is submitted:
    questionCount: Number,
    score: Number,
    totalMarks: Number,
    percentage: Number,
    correct: Number,
    incorrect: Number,
    unanswered: Number,
  },
  { timestamps: true }
);

// A student can have only ONE attempt in progress per exam, even if two requests arrive together.
attemptSchema.index({ examId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: "in_progress" } });
// Let the sweeper find attempts past their closing time without scanning every attempt.
attemptSchema.index({ deadline: 1 }, { partialFilterExpression: { status: "in_progress" } });
attemptSchema.index({ closeAt: 1 }, { partialFilterExpression: { status: "in_progress" } });

module.exports = mongoose.model("Attempt", attemptSchema);
