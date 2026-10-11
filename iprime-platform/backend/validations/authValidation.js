const Joi = require("joi");

// "teacher" and "admin" are deliberately missing: nobody can give themselves those roles at signup.
// Admins are created with `npm run create-admin`; teachers are assigned by an admin.
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
    // bcrypt only uses the first 72 bytes, so longer passwords add nothing.
    password: Joi.string().min(8).max(72).required(),
  }),
  verifyOtp: Joi.object({ email, otp: Joi.string().pattern(/^\d{6}$/).required() }),
  resendOtp: Joi.object({ email }),
  login: Joi.object({ email, password: Joi.string().max(72).required() }),
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
