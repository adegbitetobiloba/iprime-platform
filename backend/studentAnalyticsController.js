const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const { buildStudentAnalytics } = require("../utils/analytics");

// GET /api/student/analytics  — the signed-in student's own analytics only (userId comes from the verified token).
// Exam questions (with keys) are read here on the server to re-grade and tag; nothing from them but question text,
// topic and the student's own missed/not-missed result is returned. Correct answers and explanations never leave.
exports.analytics = async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id, status: "submitted" })
      .sort({ submittedAt: -1 }).limit(500).lean();
    const examIds = [...new Set(attempts.map((a) => String(a.examId)))];
    const exams = examIds.length ? await Exam.find({ _id: { $in: examIds } }).lean() : [];
    const data = buildStudentAnalytics({ attempts, exams });
    res.json({ generatedAt: new Date().toISOString(), truncated: attempts.length === 500, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
