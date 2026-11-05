// Real wiring for the access checks that sit in front of the exam routes (logic lives in utils/examAccess.js).
const { makeAccess } = require("../utils/examAccess");
const access = makeAccess({
  ExamAccess: require("../models/ExamAccess"), ExamShare: require("../models/ExamShare"), ShareGrant: require("../models/ShareGrant"),
  ExamUnlock: require("../models/ExamUnlock"), Attempt: require("../models/Attempt"), requireRole: require("./roleMiddleware"),
});
module.exports = access;
