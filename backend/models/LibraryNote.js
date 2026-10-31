const mongoose = require("mongoose");

// Private study notes: one per student per lesson, visible only to that student.
const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryLesson", required: true },
    text: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true }
);
noteSchema.index({ user: 1, lesson: 1 }, { unique: true });

module.exports = mongoose.model("LibraryNote", noteSchema);
