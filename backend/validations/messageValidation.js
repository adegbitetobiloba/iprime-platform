const Joi = require("joi");

const oid = Joi.string().pattern(/^[a-f\d]{24}$/i);
// The text may be empty only when files are attached; the controller checks that.
const text = Joi.string().trim().max(2000).allow("").messages({ "string.max": "Messages can be at most 2000 characters" });
const files = Joi.array().items(oid).max(3).unique().messages({ "array.max": "You can attach up to 3 files to one message" });

module.exports = {
  studentSend: Joi.object({ body: text, fileIds: files }),
  adminSend: Joi.object({ body: text, fileIds: files, attemptId: oid.allow("", null) }),
  blockReason: Joi.object({ reason: Joi.string().trim().min(5).max(300).required().messages({ "string.min": "Give a reason (at least 5 characters)", "string.empty": "Give a reason", "any.required": "Give a reason" }) }),
  assign: Joi.object({ adminId: Joi.alternatives(Joi.string().valid("me"), oid).allow(null, "") }),
};
