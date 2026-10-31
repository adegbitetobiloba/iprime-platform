const mongoose = require("mongoose");

const enrolmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryCourse", required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    lastLesson: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryLesson" },
    lastActiveAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);
enrolmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrolmentSchema.index({ user: 1, lastActiveAt: -1 });

module.exports = mongoose.model("LibraryEnrolment", enrolmentSchema);
