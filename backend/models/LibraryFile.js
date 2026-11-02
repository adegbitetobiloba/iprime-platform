const mongoose = require("mongoose");

// Private storage for lesson PDFs, inside the existing MongoDB (no extra service or credentials).
// `data` is never selected by default, so listing or loading a lesson can never leak file bytes.
const fileSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true, select: false },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    originalName: { type: String, maxlength: 150 },
    contentType: { type: String, default: "application/pdf" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LibraryFile", fileSchema);
