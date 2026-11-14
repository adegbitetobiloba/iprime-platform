const Course = require("../models/Course");
const Exam = require("../models/Exam");
const Material = require("../models/LibraryMaterial");
const TeacherSubmission = require("../models/TeacherSubmission");
const { visibleStudents } = require("../utils/teacherAccess");

// GET /api/teacher/overview : real counts for the dashboard, from the teacher's own records only.
exports.get = async (req, res) => {
  const me = req.user.id;
  const [students, materials, courses, exams, subs] = await Promise.all([
    visibleStudents(me),
    Material.find({ createdBy: me }).select("status review"),
    Course.find({ createdBy: me }).select("status"),
    Exam.find({ createdBy: me }).select("status"),
    TeacherSubmission.find({ teacherId: me, status: { $in: ["pending", "returned"] } }),
  ]);
  const of = (kind, status) => subs.filter((s) => s.kind === kind && s.status === status).length;
  const mat = { draft: 0, underReview: 0, returned: 0, published: 0 };
  for (const m of materials) {
    if (m.status === "published") mat.published += 1;
    else if (m.review && m.review.requestedAt) mat.underReview += 1;
    else if (m.review && m.review.returnedAt) mat.returned += 1;
    else if (m.status === "draft") mat.draft += 1;
  }
  const split = (list, kind) => ({ total: list.length, published: list.filter((x) => x.status === "published").length, underReview: of(kind, "pending"), returned: of(kind, "returned") });
  res.json({ students: students.size, materials: mat, courses: split(courses, "course"), exams: split(exams, "exam") });
};
