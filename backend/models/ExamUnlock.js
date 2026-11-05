const mongoose = require("mongoose");

// "This signed-in account entered the right examination password" (for the version of the password in force then).
const examUnlockSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);
examUnlockSchema.index({ examId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("ExamUnlock", examUnlockSchema);
