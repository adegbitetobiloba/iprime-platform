const mongoose = require("mongoose");
const User = require("../models/User");
const { buildLibraryStudy } = require("../utils/libraryStudy");

const CAP = 1000;

// GET /api/admin/analytics/library-study  (administrators only; see the router)
// One row per student: how much they have studied in the Library and when they last did. Reads the Library's own
// progress records and never changes them. Only first name, last name and student ID are read from User.
exports.libraryStudy = async (req, res) => {
  try {
    const Progress = require("../models/LibraryProgress");
    const students = await User.find({ role: "student" }).select("firstName lastName studentId").sort({ createdAt: -1 }).limit(CAP + 1).lean();
    const ids = students.slice(0, CAP).map((s) => s._id);
    const rows = ids.length
      ? await Progress.aggregate([
          { $match: { user: { $in: ids.map((i) => new mongoose.Types.ObjectId(String(i))) } } },
          { $group: { _id: "$user", opened: { $sum: 1 }, completed: { $sum: { $cond: ["$completed", 1, 0] } }, seconds: { $sum: "$activeSeconds" }, watched: { $sum: "$maxWatchedSec" }, lastActiveAt: { $max: "$lastOpenedAt" }, courseSet: { $addToSet: "$course" } } },
          { $project: { opened: 1, completed: 1, seconds: 1, watched: 1, lastActiveAt: 1, courses: { $size: "$courseSet" } } },
        ])
      : [];
    const data = buildLibraryStudy({ students: students.slice(0, CAP), rows, now: new Date() });
    res.json({ generatedAt: new Date().toISOString(), truncated: students.length > CAP, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
