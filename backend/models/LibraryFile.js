const mongoose = require("mongoose");

// Metadata for a private PDF. The bytes live in GridFS (bucket "librarypdfs"), which stores files in chunks and can serve byte ranges,
// so the reader gets the first pages quickly instead of waiting for the whole file. `data` is only used by files saved by the first PDF release.
const fileSchema = new mongoose.Schema(
  {
    gridId: { type: mongoose.Schema.Types.ObjectId },
    data: { type: Buffer, select: false },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    originalName: { type: String, maxlength: 150 },
    contentType: { type: String, default: "application/pdf" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LibraryFile", fileSchema);
