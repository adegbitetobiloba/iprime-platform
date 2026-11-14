const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const TeacherSubmission = require("../models/TeacherSubmission");
const adminExams = require("./adminExamController");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// Teachers draft tests and mock examinations with the same builder code administrators use, but only on exams THEY created,
// only while the exam is a draft, and never while it waits for review. Publishing, unpublishing and deleting published exams stay with administrators.
const owned = ({ readOnly = false, allowLocked = false } = {}) => async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Examination not found", 404);
    const exam = await Exam.findById(req.params.id).select("createdBy status");
    if (!exam || String(exam.createdBy) !== String(req.user.id)) return bad(res, "Examination not found", 404);
    if (!readOnly) {
      if (exam.status !== "draft") return bad(res, "Only draft examinations can be changed here. Ask an administrator to unpublish it first.", 409);
      if (!allowLocked && (await TeacherSubmission.findOne({ kind: "exam", refId: exam._id, status: "pending" }))) return bad(res, "This examination is waiting for review. Withdraw it first if you want to change it.", 409);
    }
    req.exam = exam;
    next();
  } catch (err) { next(err); }
};
exports.owned = owned;

exports.mine = async (req, res) => {
  const exams = await Exam.find({ createdBy: req.user.id }).sort({ updatedAt: -1 }).limit(200);
  const subs = await TeacherSubmission.find({ teacherId: req.user.id, kind: "exam" }).sort({ requestedAt: 1 });
  const latest = new Map(subs.map((s) => [String(s.refId), s]));
  res.json({
    exams: exams.map((e) => {
      const s = latest.get(String(e._id));
      return {
        id: e._id, title: e.title, subject: e.subject, level: e.level, examType: e.examType, status: e.status, durationMinutes: e.durationMinutes,
        questionCount: (e.questions || []).length, updatedAt: e.updatedAt,
        review: s && ["pending", "returned"].includes(s.status) ? { status: s.status, note: s.note, requestedAt: s.requestedAt } : undefined,
      };
    }),
  });
};

exports.create = (req, res) => adminExams.create(req, res);
exports.get = (req, res) => adminExams.get(req, res);
exports.update = (req, res) => adminExams.update(req, res);
exports.remove = (req, res) => adminExams.remove(req, res);
exports.addQuestion = (req, res) => adminExams.addQuestion(req, res);
exports.importQuestions = (req, res) => adminExams.importQuestions(req, res);
exports.updateQuestion = (req, res) => adminExams.updateQuestion(req, res);
exports.removeQuestion = (req, res) => adminExams.removeQuestion(req, res);

exports.submit = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam.questions || !exam.questions.length) return res.status(422).json({ error: "This examination is not ready to submit.", errors: ["Add at least one question first."] });
  try {
    await TeacherSubmission.create({ kind: "exam", refId: exam._id, teacherId: req.user.id, title: exam.title, status: "pending" });
  } catch (err) {
    if (err && err.code === 11000) return bad(res, "This examination is already waiting for review.", 409);
    throw err;
  }
  res.status(201).json({ ok: true });
};

exports.withdraw = async (req, res) => {
  const s = await TeacherSubmission.findOne({ kind: "exam", refId: req.params.id, status: "pending" });
  if (!s) return bad(res, "This examination is not waiting for review.", 404);
  s.status = "withdrawn";
  s.resolvedAt = new Date();
  await s.save();
  res.json({ ok: true });
};
