const mongoose = require("mongoose");

// Message attachments, stored privately inside the existing MongoDB (same approach as LibraryFile: no extra service).
// `data` is never selected by default, so listing messages can never leak file bytes.
const fileSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true, select: false },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    name: { type: String, maxlength: 120 },
    contentType: { type: String, enum: ["image/png", "image/jpeg", "application/pdf"], required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    attached: { type: Boolean, default: false }, // true once a message uses it
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);
// Files that were uploaded but never sent are removed after a day.
fileSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { attached: false } });

module.exports = mongoose.model("MessageFile", fileSchema);
