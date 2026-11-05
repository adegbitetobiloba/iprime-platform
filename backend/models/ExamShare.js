const mongoose = require("mongoose");

// A link an administrator can send to people outside iPrime. The token in the link is the only secret: revoke the link to kill it.
const examShareSchema = new mongoose.Schema(
  {
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    token: { type: String, required: true, unique: true },
    label: { type: String, trim: true, maxlength: 80, default: "" },
    mode: { type: String, enum: ["guest", "account", "both"], default: "both" }, // guest = name only; account = must be logged in
    requireContact: { type: Boolean, default: false }, // guests must also give an email address or phone number
    expiresAt: { type: Date },
    maxUses: { type: Number, min: 1, max: 100000 },
    uses: { type: Number, default: 0 },
    revokedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamShare", examShareSchema);
