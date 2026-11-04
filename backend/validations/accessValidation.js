const Joi = require("joi");

const reason = Joi.string().trim().min(5).max(300).required().messages({ "string.min": "Give a reason (at least 5 characters)", "string.empty": "Give a reason", "any.required": "Give a reason" });
const money = Joi.alternatives(Joi.string().trim(), Joi.number()).required();

module.exports = {
  features: Joi.object({ enrolmentForm: Joi.boolean().required(), reason: Joi.string().trim().max(300).allow("") }),
  payment: Joi.object({
    amount: money,
    method: Joi.string().valid("bank_transfer", "cash", "pos", "other").required(),
    reference: Joi.string().trim().max(80).allow(""),
    receivedOn: Joi.date().max("now").allow(null, ""),
    note: Joi.string().trim().max(300).allow(""),
  }),
  voidReason: Joi.object({ reason }),
  verification: Joi.object({
    action: Joi.string().valid("verify", "revoke").required(),
    identityDocumentSeen: Joi.boolean(), guardianContacted: Joi.boolean(),
    note: Joi.string().trim().max(300).allow(""),
  }),
  deleteAccount: Joi.object({ confirm: Joi.string().trim().min(1).max(200).required(), reason }),
  checkIn: Joi.object({
    session: Joi.string().valid("morning", "afternoon", "evening"),
    status: Joi.string().valid("present", "late"),
    note: Joi.string().trim().max(200).allow(""),
    overrideReason: Joi.string().trim().max(300).allow(""),
  }),
  settings: Joi.object({ notice: Joi.string().trim().max(2000).allow(""), paymentInstructions: Joi.string().trim().max(2000).allow("") }).min(1),
};
