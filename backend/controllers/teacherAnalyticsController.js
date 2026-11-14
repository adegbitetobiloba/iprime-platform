const mongoose = require("mongoose");
const User = require("../models/User");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const { visibleStudents, accessFor } = require("../utils/teacherAccess");
const { audit } = require("../utils/audit");
const { studentView } = require("../utils/teacherAnalytics");

// Mounted at /api/teacher/analytics behind protect + requireTeacher (approval re-read from the database on every request).
// A teacher sees performance ONLY for students an administrator gave them (assigned directly, or through a subject group: see utils/teacherAccess.js), and only name + student ID
// as identity. Exam questions are read here to re-grade and tag; correct answers and explanations are never returned.
const NOT_FOUND = { error: "Student not found." }; // same answer for "does not exist" and "not yours": no way to probe for ids
const approved = (s) => s && (!s.approval || s.approval === "approved");

async function load(studentIds) {
  const attempts = studentIds.length ? await Attempt.find({ userId: { $in: studentIds }, status: "submitted" })
    .select("userId examId status startedAt submittedAt autoSubmitted answers questionIds score totalMarks percentage correct incorrect unanswered pausedTotalSeconds")
    .sort({ submittedAt: -1 }).limit(5000).lean() : [];
  const examIds = [...new Set(attempts.map((a) => String(a.examId)))];
  const exams = examIds.length ? await Exam.find({ _id: { $in: examIds } }).lean() : [];
  return { attempts, exams, truncated: attempts.length === 5000 };
}

// GET /api/teacher/analytics/students
exports.list = async (req, res) => {
  try {
    const access = await visibleStudents(req.user.id); // Map(studentId -> { all, subjects, via })
    const ids = [...access.keys()];
    const users = ids.length ? await User.find({ _id: { $in: ids }, role: "student" }).select("firstName lastName studentId approval").lean() : [];
    const { attempts, exams, truncated } = await load(ids);
    const rows = [];
    for (const u of users) {
      if (!approved(u)) continue;
      const a = access.get(String(u._id));
      const subjects = a.all ? [] : [...a.subjects]; // a teacher who has the student only through a subject group sees that subject only
      const mine = attempts.filter((x) => String(x.userId) === String(u._id));
      const v = studentView({ attempts: mine, exams, subjects });
      rows.push({ id: u._id, firstName: u.firstName, lastName: u.lastName, studentId: u.studentId, subjects, via: a.via, ...v.summary });
    }
    rows.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
    res.json({ generatedAt: new Date().toISOString(), truncated, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); }
};

// GET /api/teacher/analytics/students/:studentId
exports.one = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.isValidObjectId(studentId)) return res.status(404).json(NOT_FOUND);
    const access = await accessFor(req.user.id, studentId);
    if (!access.ok) return res.status(404).json(NOT_FOUND);
    const subjects = access.subjects ? [...access.subjects] : [];
    const u = await User.findOne({ _id: studentId, role: "student" }).select("firstName lastName studentId approval").lean();
    if (!approved(u)) return res.status(404).json(NOT_FOUND);

    await audit(req, { entityType: "teacher_view", entityId: studentId, event: "analytics.teacher_viewed_student", meta: { studentId: u.studentId || null } }); // before any data is sent
    const { attempts, exams, truncated } = await load([studentId]);
    const v = studentView({ attempts, exams, subjects });
    res.json({
      generatedAt: new Date().toISOString(), truncated,
      student: { id: u._id, firstName: u.firstName, lastName: u.lastName, studentId: u.studentId },
      scope: { subjects, restricted: v.restricted, via: access.via },
      summary: v.summary, ...v.analytics,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); }
};
