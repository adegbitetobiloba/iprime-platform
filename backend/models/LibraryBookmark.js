const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryLesson", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryCourse", required: true },
  },
  { timestamps: true }
);
bookmarkSchema.index({ user: 1, lesson: 1 }, { unique: true });

module.exports = mongoose.model("LibraryBookmark", bookmarkSchema);
