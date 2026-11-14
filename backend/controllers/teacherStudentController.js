const User = require("../models/User");
const mongoose = require("mongoose");
const { visibleStudents, accessFor } = require("../utils/teacherAccess");

const approved = (u) => !u.approval || u.approval === "approved";

// GET /api/teacher/students
// The students an administrator gave this teacher, directly or through a subject group, and only what a teacher needs to teach them:
// name and student ID. No email, phone, address, date of birth, guardian or payment details.
// (Performance numbers come from /api/teacher/analytics, which uses the same access rule.)
exports.list = async (req, res) => {
  const map = await visibleStudents(req.user.id);
  const ids = [...map.keys()];
  const students = ids.length ? await User.find({ _id: { $in: ids }, role: "student" }).select("firstName lastName studentId approval") : [];
  const rows = students
    .filter(approved) // pending, rejected and suspended students are not shown
    .map((s) => ({ id: s._id, firstName: s.firstName, lastName: s.lastName, studentId: s.studentId, via: map.get(String(s._id)).via }))
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  res.json({ students: rows });
};

// Resolves to the access result, or null when this teacher is not allowed to see that student. Used by every feature that touches ONE student's data.
exports.access = async (teacherId, studentId) => {
  if (!mongoose.isValidObjectId(studentId)) return null;
  const a = await accessFor(teacherId, studentId);
  return a.ok ? a : null;
};
