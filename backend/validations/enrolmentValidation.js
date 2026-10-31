const Joi = require("joi");

const oid = Joi.string().pattern(/^[a-f\d]{24}$/i);
const t = (n) => Joi.string().trim().max(n).allow("");
const phone = Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).allow("").messages({ "string.pattern.base": "Enter a valid phone number" });
const email = Joi.string().trim().lowercase().email().allow("");
const year = new Date().getFullYear();

// Student-editable fields only. validate() strips unknown keys, so subjectsRegistered, office, status and reviews can never be sent by a student.
const draftFields = {
  student: Joi.object({ preferredName: t(60), dob: Joi.date().max("now").allow(null).messages({ "date.max": "Date of birth cannot be in the future" }), maritalStatus: t(30), stateOfOrigin: t(60), lga: t(80), address: t(300), phone, whatsapp: phone, email }),
  guardian: Joi.object({ name: t(100), relationship: t(60), occupation: t(100), phone, altPhone: phone, email, address: t(300) }),
  academic: Joi.object({ currentSchool: t(120), currentClass: t(60), graduationYear: Joi.number().integer().min(1950).max(year + 10).allow(null), examinationWritten: t(120), bestGrades: t(500) }),
  subjectsRequested: Joi.array().items(Joi.string().trim().min(1).max(60)).max(20).unique(),
  otherSubject: t(80),
  studyMode: Joi.string().valid("physical", "online", "hybrid"),
  session: Joi.string().valid("morning", "afternoon", "evening"),
  technology: Joi.object({ ownsSmartphone: Joi.boolean(), availableForVirtual: Joi.boolean() }),
  payment: Joi.object({ agreedFee: Joi.alternatives(Joi.string().trim(), Joi.number()).allow(null, ""), currency: Joi.string().valid("NGN"), plan: Joi.string().valid("weekly", "biweekly", "monthly") }),
  health: Joi.object({ condition: t(500), emergencyName: t(100), emergencyPhone: phone }),
  referral: Joi.object({ source: t(120), referrerName: t(100) }),
  mockScore: Joi.number().min(0).max(1000).allow(null),
};

module.exports = {
  createDraft: Joi.object({ programmeId: oid.required(), ...draftFields }),
  saveDraft: Joi.object(draftFields),
  submit: Joi.object({
    acknowledgements: Joi.object({
      studentCommitment: Joi.boolean().valid(true).required(),
      guardian: Joi.object({ signerName: Joi.string().trim().min(1).max(100).required(), relationship: Joi.string().trim().min(1).max(60).required() }),
    }).required(),
  }),
  reviewNote: Joi.object({ note: Joi.string().trim().max(500).allow("") }),
  officeUpdate: Joi.object({
    subjectsRegistered: Joi.array().items(Joi.string().trim().min(1).max(60)).max(20).unique(),
    feeApproved: Joi.alternatives(Joi.string().trim(), Joi.number()),
    currency: Joi.string().valid("NGN"),
  }).min(1),
};
