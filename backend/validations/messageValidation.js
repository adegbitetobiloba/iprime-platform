const Joi = require("joi");

const body = Joi.string().trim().min(1).max(2000).required().messages({ "string.empty": "Write a message first", "string.min": "Write a message first", "string.max": "Messages can be at most 2000 characters", "any.required": "Write a message first" });

module.exports = {
  studentSend: Joi.object({ body }),
  adminSend: Joi.object({ body, attemptId: Joi.string().pattern(/^[a-f\d]{24}$/i).allow("", null) }),
};
