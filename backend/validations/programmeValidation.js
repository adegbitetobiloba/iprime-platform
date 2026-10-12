const Joi = require("joi");

// No defaults: model defaults apply on create, so an update never resets a field by accident.
const fields = {
  title: Joi.string().trim().min(1).max(120),
  summary: Joi.string().trim().max(240).allow(""),
  description: Joi.string().trim().max(3000).allow(""),
  audience: Joi.string().trim().max(120).allow(""),
  subjects: Joi.array().items(Joi.string().trim().min(1).max(60)).max(30),
  mode: Joi.string().valid("", "physical", "online", "hybrid"),
  schedule: Joi.string().trim().max(300).allow(""),
  status: Joi.string().valid("draft", "published"),
  order: Joi.number().integer().min(0).max(1000),
};

module.exports = {
  createProgramme: Joi.object(fields).fork(["title"], (s) => s.required()),
  updateProgramme: Joi.object(fields),
};
