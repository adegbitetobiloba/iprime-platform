// Real wiring for the result breakdown and leaderboard (logic lives in utils/examExtrasService.js).
const { makeExamExtrasService } = require("../utils/examExtrasService");
const { rankFirstAttempts } = require("../utils/cohortAnalytics"); // the SAME ranking rules as the analytics
module.exports = makeExamExtrasService({
  Attempt: require("../models/Attempt"), Exam: require("../models/Exam"), ExamAccess: require("../models/ExamAccess"), ExamShare: require("../models/ExamShare"),
  people: require("../utils/people"), rankFirstAttempts,
});
