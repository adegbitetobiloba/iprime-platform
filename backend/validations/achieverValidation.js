const Joi = require("joi");

// Portraits are files that the website already serves from /images/achievers/. No arbitrary URLs are accepted.
const PORTRAIT = /^\/images\/achievers\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/;

// No defaults: model defaults apply on create, so an update never resets a field by accident.
const fields = {
  name: Joi.string().trim().max(120).allow(""),
  label: Joi.string().trim().max(60).allow(""),
  examType: Joi.string().trim().min(1).max(60),
  year: Joi.number().integer().min(2000).max(2100).allow(null),
  score: Joi.number().min(0).max(1000),
  programme: Joi.string().trim().max(120).allow(""),
  testimonial: Joi.string().trim().max(400).allow(""),
  testimonialApproved: Joi.boolean(),
  portraitPath: Joi.string().trim().max(200).pattern(PORTRAIT).allow(""),
  portraitAlt: Joi.string().trim().max(200).allow(""),
  verified: Joi.boolean(),
  evidenceRef: Joi.string().trim().max(200).allow(""),
  consent: Joi.string().valid("pending", "granted", "withdrawn"),
  isMinor: Joi.boolean(),
  guardianConsent: Joi.boolean(),
  imageConsent: Joi.boolean(),
  published: Joi.boolean(),
  order: Joi.number().integer().min(0).max(1000),
};

module.exports = {
  createAchiever: Joi.object(fields).fork(["score"], (s) => s.required()),
  updateAchiever: Joi.object(fields),
};
