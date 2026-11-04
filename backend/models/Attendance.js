const mongoose = require("mongoose");

// A check-in is never deleted: a mistake is voided with a reason, so the register stays trustworthy.
const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true }, // the calendar day in Nigeria (WAT, UTC+1)
    session: { type: String, enum: ["morning", "afternoon", "evening"], required: true },
    status: { type: String, enum: ["present", "late"], default: "present" },
    checkedInAt: { type: Date, default: Date.now },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    checkedInByName: { type: String, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 200 },
    override: { type: Boolean, default: false }, // checked in although not yet verified or approved
    overrideReason: { type: String, maxlength: 300 },
    active: { type: Boolean, default: true },
    voidedAt: Date, voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, voidReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);
// One live check-in per student, day and session. Voided ones do not count, so a mistake can be corrected.
attendanceSchema.index({ studentId: 1, day: 1, session: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model("Attendance", attendanceSchema);
