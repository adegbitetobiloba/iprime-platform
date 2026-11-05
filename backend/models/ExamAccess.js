const mongoose = require("mongoose");

// Who can find and open one examination, and whether it must be taken in a locked exam browser (Safe Exam Browser).
// Kept in its own collection so it never touches the Exam document or the Exam Guard settings. One row per exam.
const examAccessSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, unique: true },
    // The examination password: anyone sitting THIS exam (account or link) must enter it before starting. It is not a login
    // password. Stored only as a salted hash; the examiner can replace or remove it but never read it back.
    passwordHash: { type: String },
    passwordSalt: { type: String },
    passwordVersion: { type: Number, default: 0 }, // bumped whenever it changes, so earlier "unlocks" stop counting
    passwordSetAt: { type: Date },
    listed: { type: Boolean, default: true }, // false = "link only": hidden from the examination list, reachable through a share link
    lockedBrowser: {
      required: { type: Boolean, default: false },
      browserExamKeys: { type: [String], default: [] }, // 64-character hex keys from Safe Exam Browser (matched against the request hash)
      configKeys: { type: [String], default: [] },      // 64-character hex Config Keys (matched against the config-key hash)
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamAccess", examAccessSchema);
