const Joi = require("joi");
const { OPTION_KEYS } = require("../utils/cbt");

const optionalDate = Joi.date().allow(null, "");

// No defaults here: model defaults apply on create, so an update never silently resets a field.
const examFields = {
  title: Joi.string().trim().min(1).max(150),
  description: Joi.string().trim().max(1000).allow(""),
  subject: Joi.string().trim().min(1).max(80),
  level: Joi.string().trim().max(60).allow(""),
  examType: Joi.string().trim().max(60).allow(""),
  instructions: Joi.string().trim().max(3000).allow(""),
  durationMinutes: Joi.number().integer().min(1).max(360),
  maxAttempts: Joi.number().integer().min(1).max(20),
  showAnswersAfter: Joi.boolean(),
  shuffleQuestions: Joi.boolean(), 
  shuffleOptions: Joi.boolean(),
  availableFrom: optionalDate,
  availableUntil: optionalDate,
};

const question = Joi.object({
  text: Joi.string().trim().min(1).max(4000).required(),
  options: Joi.array().items(Joi.object({
    key: Joi.string().valid(...OPTION_KEYS).required(),
    text: Joi.string().trim().min(1).max(1000).required(),
  })).min(2).max(6).required(),
  correctKey: Joi.string().valid(...OPTION_KEYS).required(),
  marks: Joi.number().min(0.5).max(100),
  topic: Joi.string().trim().max(120).allow(""),
  explanation: Joi.string().trim().max(4000).allow(""),
}).custom((v, helpers) => {
  const keys = v.options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) return helpers.message("Option letters must be different from each other");
  if (!keys.includes(v.correctKey)) return helpers.message("The correct answer must be one of the options");
  return v;
});

module.exports = {
  createExam: Joi.object(examFields).fork(["title", "subject", "durationMinutes"], (s) => s.required()),
  updateExam: Joi.object(examFields),
  question,
  importQuestions: Joi.object({ text: Joi.string().min(1).max(200000).required() }),
  saveAnswer: Joi.object({
    questionId: Joi.string().hex().length(24).required(),
    choice: Joi.string().valid(...OPTION_KEYS).allow(null),
    flagged: Joi.boolean(),
  }).or("choice", "flagged"),
};
