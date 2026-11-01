const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    startedAt: { type: Date, required: true },
    deadline: { type: Date, required: true }, // fixed by the server at start; the countdown is derived from this
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    seed: { type: String }, 
    shuffleQuestions: { type: Boolean, default: false }, 
    shuffleOptions: { type: Boolean, default: false },
    answers: { type: Map, of: String, default: () => ({}) }, // questionId -> option key
    flagged: { type: [String], default: [] },                // questionIds marked for review
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

module.exports = mongoose.model("Attempt", attemptSchema);
