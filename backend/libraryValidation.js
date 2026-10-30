const Joi = require("joi");
const { STATUSES, DIFFICULTIES, CONTENT_TYPES } = require("../utils/library");

const id = Joi.string().hex().length(24);
const httpsUrl = Joi.string().trim().uri({ scheme: ["https"] }).max(500);

module.exports = {
  subject: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    description: Joi.string().trim().max(500).allow(""),
    group: Joi.string().valid("subject", "exam-prep"),
    order: Joi.number().integer().min(0).max(10000),
    status: Joi.string().valid("active", "archived"),
  }),
  subjectUpdate: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    description: Joi.string().trim().max(500).allow(""),
    group: Joi.string().valid("subject", "exam-prep"),
    order: Joi.number().integer().min(0).max(10000),
    status: Joi.string().valid("active", "archived"),
  }).min(1),
  course: Joi.object({
    title: Joi.string().trim().min(3).max(150).required(),
    description: Joi.string().trim().max(3000).allow(""),
    coverImageUrl: httpsUrl.allow(""),
    subject: id.required(),
    examTags: Joi.array().items(Joi.string().trim().max(30)).max(10),
    objectives: Joi.array().items(Joi.string().trim().min(1).max(300)).max(20),
    difficulty: Joi.string().valid(...DIFFICULTIES),
    estimatedMinutes: Joi.number().integer().min(0).max(100000),
    featured: Joi.boolean(),
  }),
  courseUpdate: Joi.object({
    title: Joi.string().trim().min(3).max(150),
    description: Joi.string().trim().max(3000).allow(""),
    coverImageUrl: httpsUrl.allow(""),
    subject: id,
    examTags: Joi.array().items(Joi.string().trim().max(30)).max(10),
    objectives: Joi.array().items(Joi.string().trim().min(1).max(300)).max(20),
    difficulty: Joi.string().valid(...DIFFICULTIES),
    estimatedMinutes: Joi.number().integer().min(0).max(100000),
    featured: Joi.boolean(),
  }).min(1),
  status: Joi.object({ status: Joi.string().valid(...STATUSES).required() }),
  module: Joi.object({
    title: Joi.string().trim().min(2).max(150).required(),
    description: Joi.string().trim().max(1000).allow(""),
    topics: Joi.array().items(Joi.object({ _id: id, title: Joi.string().trim().min(1).max(150).required() })).max(50),
  }),
  moduleUpdate: Joi.object({
    title: Joi.string().trim().min(2).max(150),
    description: Joi.string().trim().max(1000).allow(""),
    topics: Joi.array().items(Joi.object({ _id: id, title: Joi.string().trim().min(1).max(150).required() })).max(50),
  }).min(1),
  lesson: Joi.object({
    title: Joi.string().trim().min(2).max(150).required(),
    topicId: id.allow(null),
    contentType: Joi.string().valid(...CONTENT_TYPES).required(),
    body: Joi.string().max(60000).allow(""),
    videoUrl: Joi.string().trim().max(500).allow(""), // parsed server-side; only YouTube/Vimeo accepted
    externalUrl: httpsUrl.allow(""),
    estimatedMinutes: Joi.number().integer().min(0).max(1000),
    practice: Joi.object({ exam: id.allow(null), topic: Joi.string().trim().max(120).allow("") }),
    requiresQuizPass: Joi.boolean(),
  }),
  lessonUpdate: Joi.object({
    title: Joi.string().trim().min(2).max(150),
    topicId: id.allow(null),
    body: Joi.string().max(60000).allow(""),
    videoUrl: Joi.string().trim().max(500).allow(""),
    externalUrl: httpsUrl.allow(""),
    estimatedMinutes: Joi.number().integer().min(0).max(1000),
    practice: Joi.object({ exam: id.allow(null), topic: Joi.string().trim().max(120).allow("") }),
    requiresQuizPass: Joi.boolean(),
    status: Joi.string().valid(...STATUSES),
  }).min(1),
  reorder: Joi.object({ ids: Joi.array().items(id).min(1).max(500).unique().required() }),
};
