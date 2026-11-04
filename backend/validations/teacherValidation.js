const Joi = require("joi");
const lib = require("./libraryValidation");

const id = Joi.string().hex().length(24);
const email = Joi.string().trim().lowercase().email().max(254);
const password = Joi.string().min(8).max(72); // 72 = the most characters bcrypt uses
const phone = Joi.string().trim().pattern(/^[0-9+()\-\s]{7,20}$/).messages({ "string.pattern.base": "Enter a valid phone number" });
const subjects = Joi.array().items(Joi.string().trim().min(2).max(60)).min(1).max(15);

module.exports = {
  apply: Joi.object({
    firstName: Joi.string().trim().min(1).max(60).required(),
    lastName: Joi.string().trim().min(1).max(60).required(),
    email: email.required(),
    phone: phone.required(),
    state: Joi.string().trim().min(2).max(60).required(),
    password: password.required(),
    subjects: subjects.required(),
    qualification: Joi.string().trim().min(2).max(200).required(),
    bio: Joi.string().trim().max(1000).allow(""),
    yearsExperience: Joi.number().integer().min(0).max(60),
  }),
  login: Joi.object({ email: email.required(), password: Joi.string().min(1).max(200).required() }),
  verifyOtp: Joi.object({ email: email.required(), otp: Joi.string().trim().pattern(/^\d{6}$/).required() }),
  resendOtp: Joi.object({ email: email.required() }),
  // Teachers can change these themselves. Role, approval and email are NOT here, so they can never be changed through this form.
  profile: Joi.object({
    phone, state: Joi.string().trim().min(2).max(60),
    subjects, qualification: Joi.string().trim().min(2).max(200),
    bio: Joi.string().trim().max(1000).allow(""), yearsExperience: Joi.number().integer().min(0).max(60),
  }).min(1),
  decision: Joi.object({ action: Joi.string().valid("approve", "reject", "suspend", "reinstate").required(), note: Joi.string().trim().max(300).allow("") }),
  assign: Joi.object({ studentId: id.required(), subjects: Joi.array().items(Joi.string().trim().min(2).max(60)).max(15) }),
  // Library: a teacher may create and edit drafts, but cannot feature or publish anything.
  material: lib.material.fork(["featured"], (s) => s.forbidden()),
  materialUpdate: lib.materialUpdate.fork(["featured"], (s) => s.forbidden()),
  reorder: lib.reorder,
  libraryDecision: Joi.object({ action: Joi.string().valid("publish", "return").required(), note: Joi.string().trim().max(300).allow("") }),
};
