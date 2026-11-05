const mongoose = require("mongoose");

// "This signed-in account opened the examination through this link." Needed to take a link-only examination.
const shareGrantSchema = new mongoose.Schema(
  {
    shareId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamShare", required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
shareGrantSchema.index({ shareId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("ShareGrant", shareGrantSchema);
