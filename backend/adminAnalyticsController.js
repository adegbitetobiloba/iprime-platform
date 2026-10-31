const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const User = require("../models/User");
const { buildExamCohort } = require("../utils/cohortAnalytics");

// GET /api/admin/analytics/exams/:examId  (administrators only; see the router)
// Names are limited to first name, last name and student ID. No contact, guardian, medical or payment fields are read.
exports.examCohort = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) return res.status(400).json({ error: "Invalid examination id." });
    const exam = await Exam.findById(examId).lean();
    if (!exam) return res.status(404).json({ error: "Examination not found." });

    const attempts = await Attempt.find({ examId, status: "submitted" })
      .select("userId status startedAt submittedAt autoSubmitted answers score totalMarks percentage correct incorrect unanswered")
      .sort({ submittedAt: 1 }).limit(5000).lean();
    const data = buildExamCohort({ exam, attempts });

    const ids = [...new Set([...data.top, ...data.support].map((r) => r.userId))];
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName studentId").lean() : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const named = (r) => { const u = byId.get(r.userId); return { ...r, name: u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "Former student", studentId: u?.studentId || null }; };

    res.json({ generatedAt: new Date().toISOString(), truncated: attempts.length === 5000, ...data, top: data.top.map(named), support: data.support.map(named) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
