const Joi = require("joi");
const { OPTION_KEYS } = require("../utils/cbt");
const { CLIENT_EVENT_TYPES } = require("../utils/guard");

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
  questionsPerStudent: Joi.number().integer().min(1).max(500).allow(null),
  drawSpread: Joi.boolean(),
  drawBalance: Joi.boolean(),
  drawMixDifficulty: Joi.boolean(),
  reconnectGraceMinutes: Joi.number().integer().min(0).max(60).allow(null),
  guard: Joi.object({
    enabled: Joi.boolean(),
    monitorFocus: Joi.boolean(),
    requireFullscreen: Joi.boolean(),
    maxViolations: Joi.number().integer().min(1).max(20),
    autoSubmit: Joi.boolean(),
    minAwaySeconds: Joi.number().min(0).max(30),
    blockCopyPaste: Joi.boolean(),
  }),
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
  // What the exam screen reports about the student's own browser (see utils/guard.js). The server decides what counts.
  attemptEvents: Joi.object({
    events: Joi.array().items(Joi.object({
      eid: Joi.string().trim().min(8).max(64).required(),
      type: Joi.string().valid(...CLIENT_EVENT_TYPES).required(),
      at: Joi.date().iso(),
      durationMs: Joi.number().integer().min(0).max(6 * 3600 * 1000),
      reasons: Joi.array().items(Joi.string().valid("hidden", "blur")).max(2),
    })).min(1).max(50).required(),
  }),
  // Everything the student's device still holds, sent in one go when submitting (see utils/lateSync.js).
  // answeredAt is when the device says the change was made; the server checks it against the deadline.
  syncAnswers: Joi.object({
    answers: Joi.array().items(Joi.object({
      questionId: Joi.string().hex().length(24).required(),
      choice: Joi.string().valid(...OPTION_KEYS).allow(null),
      flagged: Joi.boolean(),
      answeredAt: Joi.date().iso(),
    }).or("choice", "flagged")).max(600).default([]),
  }),
};
