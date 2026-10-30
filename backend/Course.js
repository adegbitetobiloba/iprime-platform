const mongoose = require("mongoose");
const { STATUSES, DIFFICULTIES } = require("../utils/library");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 3000 },
    coverImageUrl: { type: String, trim: true, maxlength: 500 }, // https only (validated); uploads come with storage
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "LibrarySubject", required: true, index: true },
    examTags: [{ type: String, trim: true, maxlength: 30 }], // e.g. "JAMB", "WAEC", "NECO"
    objectives: [{ type: String, trim: true, maxlength: 300 }],
    difficulty: { type: String, enum: DIFFICULTIES, default: "beginner" },
    estimatedMinutes: { type: Number, min: 0, max: 100000, default: 0 },
    status: { type: String, enum: STATUSES, default: "draft", index: true },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
courseSchema.index({ status: 1, featured: 1, publishedAt: -1 });

module.exports = mongoose.model("LibraryCourse", courseSchema);
