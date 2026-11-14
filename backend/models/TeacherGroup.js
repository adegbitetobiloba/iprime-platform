const mongoose = require("mongoose");

// A RULE, not a list: "this teacher looks after every student whose approved enrolment includes <subject>" (optionally within one programme).
// Students are looked up when the teacher asks, so a student who is approved for Chemistry later appears automatically,
// and one whose subjects change disappears. Created and ended by administrators only.
const groupSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true, maxlength: 60 },
    subjectKey: { type: String, required: true }, // lower-case subject, so "Chemistry" and "chemistry" are one rule
    programmeId: { type: mongoose.Schema.Types.ObjectId, ref: "Programme" },
    programmeKey: { type: String, default: "" },  // "" = any programme
    status: { type: String, enum: ["active", "ended"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedAt: { type: Date },
  },
  { timestamps: true }
);
groupSchema.index({ teacherId: 1, subjectKey: 1, programmeKey: 1 }, { unique: true });

module.exports = mongoose.model("TeacherGroup", groupSchema);
