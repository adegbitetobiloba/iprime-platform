// Real wiring for the examiner's access controls (logic lives in utils/adminAccessService.js).
const { makeAdminAccessService } = require("../utils/adminAccessService");
const { audit } = require("../utils/audit");
const access = require("../middleware/examAccess");

module.exports = makeAdminAccessService({
  ExamAccess: require("../models/ExamAccess"), ExamShare: require("../models/ExamShare"), ShareGrant: require("../models/ShareGrant"),
  Guest: require("../models/Guest"), Exam: require("../models/Exam"), User: require("../models/User"),
  audit, invalidate: access.invalidate,
});
