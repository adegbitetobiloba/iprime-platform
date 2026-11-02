const mongoose = require("mongoose");

// One row per thing that happened during an attempt. Append-only: nothing in the app edits or deletes these, and the
// browser can only add the limited kinds of event listed in utils/guard.js. Times in `at` come from the server.
const attemptEventSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true, maxlength: 40 },
    source: { type: String, enum: ["client", "server"], default: "server" },
    eid: { type: String, maxlength: 64 },   // set by the browser; a resent event is recognised and not counted twice
    at: { type: Date, required: true },     // when the server recorded it
    clientAt: { type: Date },               // when the browser says it happened (not trusted)
    durationMs: { type: Number },           // e.g. how long the student was away
    counted: { type: Boolean, default: false }, // did it count as a violation?
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: false }
);

attemptEventSchema.index({ attemptId: 1, at: 1 });
attemptEventSchema.index({ examId: 1, type: 1 });
attemptEventSchema.index({ attemptId: 1, eid: 1 }, { unique: true, partialFilterExpression: { eid: { $type: "string" } } });

module.exports = mongoose.model("AttemptEvent", attemptEventSchema);
