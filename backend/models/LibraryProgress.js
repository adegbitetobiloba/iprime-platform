const mongoose = require("mongoose");

// One record per student per lesson. Everything here is written by the server; the browser only reports events.
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryLesson", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryCourse", required: true, index: true },
    firstOpenedAt: { type: Date },
    lastOpenedAt: { type: Date, index: true },
    openCount: { type: Number, default: 0 },
    lastEventAt: { type: Date },
    // video
    videoDurationSec: { type: Number, default: 0 },
    lastPositionSec: { type: Number, default: 0 }, // where to resume
    maxWatchedSec: { type: Number, default: 0 },
    // pdf
    pageCount: { type: Number, default: 0 },
    lastPage: { type: Number, default: 1 },
    maxPageReached: { type: Number, default: 0 },
    // written
    activeSeconds: { type: Number, default: 0 },
    reachedEnd: { type: Boolean, default: false },
    // external link / practice
    markedDone: { type: Boolean, default: false },
    quizPassed: { type: Boolean, default: false },
    // completion is recorded once and never revoked
    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);
progressSchema.index({ user: 1, lesson: 1 }, { unique: true });
progressSchema.index({ user: 1, lastOpenedAt: -1 });

module.exports = mongoose.model("LibraryProgress", progressSchema);
