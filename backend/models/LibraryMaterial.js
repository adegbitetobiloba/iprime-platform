const mongoose = require("mongoose");
const { STATUSES } = require("../utils/library");

const KINDS = ["syllabus", "textbook", "past-questions", "notes", "other"];

// A standalone study resource (syllabus, textbook, past-questions paper, notes), not tied to one course.
// It is either a web link (instant, hosted elsewhere) or a PDF held privately in iPrime.
const materialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    kind: { type: String, enum: KINDS, required: true, index: true },
    description: { type: String, trim: true, maxlength: 1500 },
    author: { type: String, trim: true, maxlength: 120 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "LibrarySubject", index: true },
    examTags: [{ type: String, trim: true, maxlength: 30 }],
    source: { type: String, enum: ["link", "pdf", "text", "image"], required: true },
    url: { type: String, trim: true, maxlength: 600 }, // https only
    file: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryFile" },
    originalName: { type: String, maxlength: 150 },
    // Written text (rendered by the safe renderer) for source "text". Loads fastest on weak phones.
    body: { type: String, maxlength: 200000 },
    // Private images for source "image" (syllabus photos, scanned notes). Array order is the reading order.
    images: [{ file: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryFile" }, name: { type: String, maxlength: 150 } }],
    sourceNote: { type: String, trim: true, maxlength: 300 }, // shown to students, e.g. "Source: JAMB UTME syllabus."
    status: { type: String, enum: STATUSES, default: "draft", index: true },
    featured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
materialSchema.index({ status: 1, kind: 1, updatedAt: -1 });

module.exports = mongoose.model("LibraryMaterial", materialSchema);
module.exports.KINDS = KINDS;
