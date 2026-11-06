const mongoose = require("mongoose");

// A student achievement shown on the public website. Created and edited only by an administrator.
// Nothing appears publicly unless it is published, verified and consented (see utils/achievers.js).
const achieverSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "" },            // optional: blank shows "Prime Excelerate scholar"
    label: { type: String, trim: true, maxlength: 60, default: "" },            // small caption under the score, e.g. "JAMB score"
    examType: { type: String, trim: true, maxlength: 60, default: "UTME" },
    year: { type: Number, min: 2000, max: 2100, default: null },
    score: { type: Number, required: true, min: 0, max: 1000 },
    programme: { type: String, trim: true, maxlength: 120, default: "" },       // programme or mode attended
    testimonial: { type: String, trim: true, maxlength: 400, default: "" },
    testimonialApproved: { type: Boolean, default: false },
    portraitPath: { type: String, trim: true, maxlength: 200, default: "" },    // a file under /images/achievers/
    portraitAlt: { type: String, trim: true, maxlength: 200, default: "" },
    verified: { type: Boolean, default: false },                                // the result has been checked against evidence
    evidenceRef: { type: String, trim: true, maxlength: 200, default: "" },     // internal only: never sent to the public
    consent: { type: String, enum: ["pending", "granted", "withdrawn"], default: "pending" },
    isMinor: { type: Boolean, default: false },
    guardianConsent: { type: Boolean, default: false },
    imageConsent: { type: Boolean, default: false },
    published: { type: Boolean, default: false, index: true },
    archived: { type: Boolean, default: false },                                // soft delete: keeps the record and the audit trail
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Achiever", achieverSchema);
