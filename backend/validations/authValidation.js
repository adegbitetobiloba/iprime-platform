const Joi = require("joi");

// Self-signup is limited to student and parent. Admins are created with
// `npm run create-admin`; teachers are assigned by an admin.
const SELF_SIGNUP_ROLES = ["student", "parent"];

const email = Joi.string().trim().lowercase().email().required();

const schemas = {
  register: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    otherNames: Joi.string().trim().max(100).allow("").optional(),
    email,
    phone: Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).required()
      .messages({ "string.pattern.base": "Enter a valid phone number" }),
    dob: Joi.date().allow("", null).optional(),
    country: Joi.string().trim().max(60).default("Nigeria"),
    state: Joi.string().trim().max(60).required(),
    role: Joi.string().valid(...SELF_SIGNUP_ROLES).default("student"),
    // These fields are kept for alumni flows outside direct self-signup.
    graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 1),
    lastClass: Joi.string().trim().max(60).allow(""),
    // bcrypt only uses the first 72 bytes, so longer passwords add nothing.
    password: Joi.string().min(8).max(72).required(),
  }),
  verifyOtp: Joi.object({ email, otp: Joi.string().pattern(/^\d{6}$/).required() }),
  resendOtp: Joi.object({ email }),
  login: Joi.object({ email, password: Joi.string().max(72).required() }),
  // Google sign-in. role is optional here: a new person who has not chosen yet is asked on the next screen.
  // Only student and parent can ever be requested here; admin cannot.
  google: Joi.object({
    credential: Joi.string().min(20).max(4096).required(),
    role: Joi.string().valid(...SELF_SIGNUP_ROLES),
  }),
  googleComplete: Joi.object({
    setupToken: Joi.string().min(20).max(4000).required(),
    role: Joi.string().valid(...SELF_SIGNUP_ROLES).required(),
    graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 1),
    lastClass: Joi.string().trim().max(60).allow(""),
  }),
  googleLink: Joi.object({ credential: Joi.string().min(20).max(4096).required() }),
  linkPassword: Joi.object({ linkToken: Joi.string().min(20).max(4000).required(), password: Joi.string().min(1).max(72).required() }),
  linkCodeSend: Joi.object({ linkToken: Joi.string().min(20).max(4000).required() }),
  linkCodeConfirm: Joi.object({ linkToken: Joi.string().min(20).max(4000).required(), code: Joi.string().pattern(/^\d{6}$/).required() }),
  alumniRequest: Joi.object({ note: Joi.string().trim().max(300).allow("") }),
  // Fields a signed-in user may edit. Email, role, password and verification status are NOT editable here.
  updateProfile: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    otherNames: Joi.string().trim().max(100).allow("").optional(),
    phone: Joi.string().trim().pattern(/^\+?[\d\s-]{7,20}$/).required()
      .messages({ "string.pattern.base": "Enter a valid phone number" }),
    dob: Joi.date().max("now").allow("", null).optional()
      .messages({ "date.max": "Date of birth cannot be in the future" }),
    state: Joi.string().trim().max(60).required(),
    graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 1),
    lastClass: Joi.string().trim().max(60).allow(""),
  }),
};

// Express middleware: validates req.body, strips unknown fields (so nobody can
// send e.g. isVerified: true), and replies 400 with a readable message.
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body || {}, { stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.details[0].message.replace(/"/g, "") });
  }
  req.body = value;
  next();
};

module.exports = { schemas, validate, SELF_SIGNUP_ROLES };
