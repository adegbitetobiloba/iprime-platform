// Real wiring for the public share endpoints (logic lives in utils/shareService.js).
const jwt = require("jsonwebtoken");
const { makeShareService } = require("../utils/shareService");

module.exports = makeShareService({
  ExamAccess: require("../models/ExamAccess"), ExamShare: require("../models/ExamShare"), ShareGrant: require("../models/ShareGrant"),
  ExamUnlock: require("../models/ExamUnlock"), Guest: require("../models/Guest"), Exam: require("../models/Exam"),
  jwt, getSecret: () => process.env.JWT_SECRET,
});
