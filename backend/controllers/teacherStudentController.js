const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");

// GET /api/teacher/students
// ONLY the students an administrator has actively assigned to this teacher, and only what a teacher needs to teach them:
// name and student ID. No email, phone, address, date of birth, guardian or payment details.
exports.list = async (req, res) => {
  const links = await TeacherAssignment.find({ teacherId: req.user.id, status: "active" });
  const ids = links.map((l) => l.studentId);
  const students = ids.length ? await User.find({ _id: { $in: ids }, role: "student" }).select("firstName lastName studentId approval") : [];
  const byId = new Map(students.map((s) => [String(s._id), s]));
  const rows = links
    .map((l) => ({ l, s: byId.get(String(l.studentId)) }))
    .filter(({ s }) => s && (!s.approval || s.approval === "approved")) // pending/rejected/suspended students are not shown
    .map(({ l, s }) => ({ id: s._id, firstName: s.firstName, lastName: s.lastName, studentId: s.studentId, subjects: l.subjects || [], assignedAt: l.assignedAt }))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  res.json({ students: rows });
};

// Shared by every later teacher feature that touches ONE student's data (monitoring, tutoring notes, messages):
// resolves to the assignment, or null when this teacher is not actively assigned to that student.
exports.activeAssignment = (teacherId, studentId) => TeacherAssignment.findOne({ teacherId, studentId, status: "active" });
