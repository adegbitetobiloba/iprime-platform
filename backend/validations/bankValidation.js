const Joi = require("joi");
const { OPTION_KEYS } = require("../utils/cbt");

const key = Joi.string().valid(...OPTION_KEYS);
const optional = (s) => s.allow("", null);
const objectId = Joi.string().hex().length(24);

const option = Joi.object({ key: key.required(), text: Joi.string().max(6000).allow("").required(), html: Joi.string().max(6000).allow("", null) });

const importItem = Joi.object({
  externalId: optional(Joi.string().trim().max(80)),
  subject: optional(Joi.string().trim().max(80)),
  topic: optional(Joi.string().trim().max(120)),
  subtopic: optional(Joi.string().trim().max(120)),
  text: Joi.string().max(20000).allow(""),
  textHtml: Joi.string().max(20000).allow("", null),
  explanationHtml: Joi.string().max(20000).allow("", null),
  sourceStatus: optional(Joi.string().max(40)),
  skipIfDuplicate: Joi.boolean(),
  options: Joi.array().items(option).max(6).default([]),
  correctKey: optional(key),
  explanation: Joi.string().max(6000).allow(""),
  explanationSource: optional(Joi.string().max(200)),
  marks: optional(Joi.number()),
  questionType: optional(Joi.string().max(60)),
  difficulty: optional(Joi.string().trim().max(30)),
  imageRef: optional(Joi.string().max(300)),
  sourceRefs: Joi.array().items(Joi.string().max(100)).max(10),
  sourcePage: optional(Joi.alternatives(Joi.string().max(30), Joi.number())),
  sourceLabel: optional(Joi.string().max(120)),
  reviewState: Joi.string().valid("ready", "needs_review"),
  approved: Joi.boolean(),
  issues: Joi.array().items(Joi.string().max(30)).max(20),
  reviewNotes: optional(Joi.string().max(1000)),
  extra: Joi.object().pattern(Joi.string().max(60), Joi.alternatives(Joi.string().max(500).allow(""), Joi.number(), Joi.boolean()).allow(null)).max(30),
});

module.exports = {
  importBatch: Joi.object({
    sessionId: Joi.string().pattern(/^[A-Za-z0-9_-]{8,64}$/).required(),
    document: optional(Joi.string().trim().max(200)),
    allowIncomplete: Joi.boolean().default(false),
    onConflict: Joi.string().valid("skip", "update").default("skip"),
    questions: Joi.array().items(importItem).min(1).max(200).required(),
  }),
  edit: Joi.object({
    subject: optional(Joi.string().trim().max(80)),
    topic: optional(Joi.string().trim().max(120)),
    subtopic: optional(Joi.string().trim().max(120)),
    text: Joi.string().max(8000).allow(""),
    options: Joi.array().items(option).max(6),
    correctKey: optional(key),
    explanation: Joi.string().max(6000).allow(""),
    solutionText: Joi.string().max(4000).allow(""),
    marks: optional(Joi.number()),
    questionType: optional(Joi.string().max(60)),
    difficulty: optional(Joi.string().trim().max(30)),
    imageRef: optional(Joi.string().max(300)),
    reviewNotes: optional(Joi.string().max(1000)),
    expectedVersion: Joi.number().integer().min(1),
  }),
  // Chooses questions for an examination (read-only: nothing is saved until the questions are added to an exam).
  select: Joi.object({
    subject: Joi.string().trim().max(80).allow(""),
    topics: Joi.array().items(Joi.string().trim().max(120)).max(50).default([]),
    count: Joi.number().integer().min(1).max(500).required(),
    manualIds: Joi.array().items(objectId).max(500).default([]),
    excludeIds: Joi.array().items(objectId).max(1000).default([]),
    verifiedOnly: Joi.boolean().default(false),
    balanceTopics: Joi.boolean().default(true),
    difficulty: Joi.object({
      mode: Joi.string().valid("any", "mix").default("any"),
      mix: Joi.object({ easy: Joi.number().min(0).max(100), medium: Joi.number().min(0).max(100), hard: Joi.number().min(0).max(100) }),
    }),
  }),
  verify: Joi.object({ verified: Joi.boolean().required() }),
  addToExam: Joi.object({ examId: objectId.required(), ids: Joi.array().items(objectId).min(1).max(200).required(), marks: Joi.number().min(0.5).max(100) }),
};
