const mongoose = require("mongoose");

// Which student a teacher looks after. Created and ended by administrators only.
// A teacher can see a student's records ONLY while an "active" assignment exists, so ending one removes access at once.
const assignmentSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjects: { type: [{ type: String, trim: true, maxlength: 60 }], default: undefined }, // optional: subjects this teacher covers for the student
    status: { type: String, enum: ["active", "ended"], default: "active" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date, default: Date.now },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endedAt: { type: Date },
  },
  { timestamps: true }
);
// One row per teacher/student pair: ending and re-assigning reuses it, and two clicks cannot create a duplicate.
assignmentSchema.index({ teacherId: 1, studentId: 1 }, { unique: true });
assignmentSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model("TeacherAssignment", assignmentSchema);
