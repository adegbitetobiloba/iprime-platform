const mongoose = require("mongoose");
const { ENROLMENT_STATUSES } = require("../utils/enrolmentRules");

const OPEN_STATUSES = ["draft", "submitted", "under_review", "more_info_required", "approved"];
const sub = (def) => new mongoose.Schema(def, { _id: false });
const str = (n) => ({ type: String, trim: true, maxlength: n });

// One application per student per programme (sections A-M of the paper form). `office` and `subjectsRegistered` are staff-only.
const enrolmentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    programmeId: { type: mongoose.Schema.Types.ObjectId, ref: "Programme", required: true },
    status: { type: String, enum: ENROLMENT_STATUSES, default: "draft", index: true },
    submittedAt: Date,

    student: sub({ preferredName: str(60), dob: Date, maritalStatus: str(30), stateOfOrigin: str(60), lga: str(80), address: str(300), phone: str(20), whatsapp: str(20), email: str(120) }),
    guardian: sub({ name: str(100), relationship: str(60), occupation: str(100), phone: str(20), altPhone: str(20), email: str(120), address: str(300) }),
    academic: sub({ currentSchool: str(120), currentClass: str(60), graduationYear: Number, examinationWritten: str(120), bestGrades: str(500) }),
    subjectsRequested: { type: [str(60)], default: [] },
    otherSubject: str(80),
    studyMode: { type: String, enum: ["", "physical", "online", "hybrid"], default: "" },
    session: { type: String, enum: ["", "morning", "afternoon", "evening"], default: "" },
    technology: sub({ ownsSmartphone: Boolean, availableForVirtual: Boolean }),
    // What the STUDENT typed. The office-approved fee is separate (office.feeApprovedMinor); neither overwrites the other.
    payment: sub({ agreedFeeMinor: { type: Number, min: 0 }, currency: { type: String, enum: ["NGN"] }, plan: { type: String, enum: ["weekly", "biweekly", "monthly"] } }),
    health: sub({ condition: str(500), emergencyName: str(100), emergencyPhone: str(20) }), // restricted: staff who need it only
    referral: sub({ source: str(120), referrerName: str(100) }),
    mockScore: Number, // SELF-REPORTED on the form. Not a verified result.

    consents: [sub({ kind: { type: String, enum: ["student_commitment", "guardian_consent"], required: true }, signerName: str(100), relationship: str(60), typedAcknowledgement: { type: Boolean, default: true }, policyVersion: str(40), textHash: str(64), at: { type: Date, default: Date.now } })],

    // STAFF ONLY. Never accepted from the student endpoints.
    subjectsRegistered: { type: [str(60)], default: [] },
    office: sub({ registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, registeredAt: Date, feeApprovedMinor: { type: Number, min: 0 }, currency: { type: String, enum: ["NGN"] } }),
    reviews: [sub({ by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: Date, action: str(30), note: str(500) })],
  },
  { timestamps: true }
);

// A student may hold only one open application per programme (rejected ones do not block a fresh start). Needs MongoDB 6.0+ for $in in the filter.
enrolmentSchema.index({ userId: 1, programmeId: 1 }, { unique: true, partialFilterExpression: { status: { $in: OPEN_STATUSES } } });

module.exports = mongoose.model("Enrolment", enrolmentSchema);
module.exports.OPEN_STATUSES = OPEN_STATUSES;
