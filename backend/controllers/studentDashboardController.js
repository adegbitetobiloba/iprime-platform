const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const { buildDashboard } = require("../utils/dashboard");
const { buildLibrarySection } = require("../utils/dashboardLibrary");

// Library activity for the dashboard, read from the Library's own per-student progress records (LibraryProgress).
// If the Library cannot be read for any reason the dashboard still works and simply reports it as unavailable.
async function loadLibrarySection(userId) {
  try {
    const mongoose = require("mongoose");
    const Progress = require("../models/LibraryProgress");
    require("../models/Lesson"); // registers LibraryLesson so populate() can resolve it
    const uid = new mongoose.Types.ObjectId(String(userId));
    const [progress, agg] = await Promise.all([
      Progress.find({ user: uid }).sort({ lastOpenedAt: -1 }).limit(12)
        .select("lesson lastOpenedAt completed pageCount lastPage lastPositionSec")
        .populate({ path: "lesson", select: "title contentType status course" }).lean(),
      Progress.aggregate([{ $match: { user: uid } }, { $group: { _id: null, completed: { $sum: { $cond: ["$completed", 1, 0] } }, seconds: { $sum: "$activeSeconds" }, watched: { $sum: "$maxWatchedSec" }, opened: { $sum: 1 } } }]),
    ]);
    return buildLibrarySection({ progress, totals: agg[0] || {} });
  } catch (err) {
    console.error("dashboard: library section unavailable:", err.message);
    return { available: false, recent: [] };
  }
}

// GET /api/student/dashboard
// Everything is read for the signed-in student only (req.user.id comes from the verified token).
exports.dashboard = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user.id;

    const [submitted, inProgress] = await Promise.all([
      Attempt.find({ userId, status: "submitted" })
        .sort({ submittedAt: -1 }).limit(200)
        .select("examId submittedAt autoSubmitted score totalMarks percentage correct incorrect unanswered")
        .lean(),
      Attempt.find({ userId, status: "in_progress" })
        .select("examId startedAt deadline answers")
        .lean(),
    ]);

    // Published exams plus any exam the student has used (so old results still show a title and subject).
    // The questions array is never loaded: only its length is counted, so no answers can leak.
    const usedIds = [...new Set([...submitted, ...inProgress].map((a) => a.examId))];
    const exams = await Exam.aggregate([
      { $match: { $or: [{ status: "published" }, { _id: { $in: usedIds } }] } },
      {
        $project: {
          title: 1, subject: 1, level: 1, examType: 1, durationMinutes: 1, maxAttempts: 1, status: 1,
          availableFrom: 1, availableUntil: 1,
          questionCount: { $size: { $ifNull: ["$questions", []] } },
        },
      },
    ]);

    const running = inProgress.map((a) => {
      const answers = a.answers instanceof Map ? Object.fromEntries(a.answers) : a.answers || {};
      return { ...a, answeredCount: Object.keys(answers).length };
    });

    const data = buildDashboard({ submitted, inProgress: running, exams, now });
    const library = await loadLibrarySection(userId);
    res.json({ generatedAt: now.toISOString(), ...data, library });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
