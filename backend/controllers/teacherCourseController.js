const mongoose = require("mongoose");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const TeacherSubmission = require("../models/TeacherSubmission");
const { publishProblems } = require("../utils/library");
const adminLib = require("./adminLibraryController");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Teachers build courses (chapters, topics, lessons) in the SAME way administrators do, by running the same library code,
// but only on their OWN courses, only while a course is a draft, and never while it is waiting for review.
// They cannot publish, archive, feature, or change a lesson's status; an administrator does that after review.
const pending = (courseId) => TeacherSubmission.findOne({ kind: "course", refId: courseId, status: "pending" });

// via: which id is in req.params.id. "course" | "module" | "lesson". The owning course is always found and checked.
const guard = ({ via = "course", readOnly = false, allowLocked = false } = {}) => async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Not found", 404);
    let courseId = req.params.id;
    if (via === "module") { const m = await CourseModule.findById(req.params.id).select("course"); if (!m) return bad(res, "Not found", 404); courseId = m.course; }
    if (via === "lesson") { const l = await Lesson.findById(req.params.id).select("course"); if (!l) return bad(res, "Not found", 404); courseId = l.course; }
    const course = await Course.findById(courseId).select("createdBy status");
    if (!course || String(course.createdBy) !== String(req.user.id)) return bad(res, "Not found", 404); // not yours = does not exist
    if (!readOnly) {
      if (course.status !== "draft") return bad(res, "Only draft courses can be changed here. Ask an administrator to change a published course.", 409);
      if (!allowLocked && (await pending(course._id))) return bad(res, "This course is waiting for review. Withdraw it first if you want to change it.", 409);
    }
    req.course = course;
    next();
  } catch (err) { next(err); }
};
exports.guard = guard;

exports.mine = async (req, res) => {
  const courses = await Course.find({ createdBy: req.user.id }).populate("subject", "name slug").sort({ updatedAt: -1 }).limit(200).lean();
  const ids = courses.map((c) => c._id);
  const lessons = ids.length ? await Lesson.find({ course: { $in: ids } }).select("course") : [];
  const subs = await TeacherSubmission.find({ teacherId: req.user.id, kind: "course" }).sort({ requestedAt: 1 });
  const latest = new Map(subs.map((s) => [String(s.refId), s])); // later entries replace earlier ones
  res.json({
    courses: courses.map((c) => {
      const s = latest.get(String(c._id));
      return {
        id: c._id, title: c.title, subject: c.subject, status: c.status, updatedAt: c.updatedAt,
        lessonCount: lessons.filter((l) => String(l.course) === String(c._id)).length,
        review: s && ["pending", "returned"].includes(s.status) ? { status: s.status, note: s.note, requestedAt: s.requestedAt } : undefined,
      };
    }),
  });
};

exports.create = (req, res) => { delete req.body.featured; return adminLib.createCourse(req, res); };
exports.get = (req, res) => adminLib.getCourse(req, res);
exports.update = (req, res) => { delete req.body.featured; delete req.body.status; return adminLib.updateCourse(req, res); };
exports.createModule = (req, res) => adminLib.createModule(req, res);
exports.updateModule = (req, res) => adminLib.updateModule(req, res);
exports.deleteModule = (req, res) => adminLib.deleteModule(req, res);
exports.reorderModules = (req, res) => adminLib.reorderModules(req, res);
exports.createLesson = (req, res) => { delete req.body.status; return adminLib.createLesson(req, res); };
exports.updateLesson = (req, res) => { delete req.body.status; return adminLib.updateLesson(req, res); };
exports.deleteLesson = (req, res) => adminLib.deleteLesson(req, res);
exports.reorderLessons = (req, res) => adminLib.reorderLessons(req, res);
exports.uploadPdf = (req, res) => adminLib.uploadPdf(req, res);

exports.submit = async (req, res) => {
  const course = await Course.findById(req.params.id);
  const lessons = await Lesson.find({ course: course._id });
  const problems = publishProblems(course, lessons);
  if (problems.length) return res.status(422).json({ error: "This course is not ready to submit.", errors: problems });
  try {
    await TeacherSubmission.create({ kind: "course", refId: course._id, teacherId: req.user.id, title: course.title, status: "pending" });
  } catch (err) {
    if (err && err.code === 11000) return bad(res, "This course is already waiting for review.", 409);
    throw err;
  }
  res.status(201).json({ ok: true });
};

exports.withdraw = async (req, res) => {
  const s = await TeacherSubmission.findOne({ kind: "course", refId: req.params.id, status: "pending" });
  if (!s) return bad(res, "This course is not waiting for review.", 404);
  s.status = "withdrawn";
  s.resolvedAt = new Date();
  await s.save();
  res.json({ ok: true });
};
