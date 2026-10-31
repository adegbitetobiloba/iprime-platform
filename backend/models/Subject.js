const mongoose = require("mongoose");

// One record per subject. Exams keep their free-text `subject`; the Library matches by name, nothing is migrated.
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    group: { type: String, enum: ["subject", "exam-prep"], default: "subject" }, // exam-prep: e.g. JAMB, WAEC, NECO
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true }
);
subjectSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("LibrarySubject", subjectSchema);
