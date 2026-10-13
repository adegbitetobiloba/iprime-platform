const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const User = require("../models/User");
const { parseQuestionText } = require("../utils/cbt");

const isId = (v) => mongoose.isValidObjectId(v);
const MAX_QUESTIONS = 500;
const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

const clean = (body) => {
  const out = {};
  for (const [k, v] of Object.entries(body)) out[k] = (k === "availableFrom" || k === "availableUntil") && (v === "" || v === null) ? null : v;
  return out;
};

const find = async (req, res) => {
  if (!isId(req.params.id)) { res.status(404).json({ error: "Examination not found" }); return null; }
  const exam = await Exam.findById(req.params.id);
  if (!exam) { res.status(404).json({ error: "Examination not found" }); return null; }
  return exam;
};

// Questions may only change while the exam is a draft and nobody has attempted it, so scores can never shift under a student.
const lockedReason = async (exam) => {
  if (exam.status === "published") return "Unpublish the examination before editing its questions.";
  if (await Attempt.exists({ examId: exam._id })) return "This examination already has attempts, so its questions can no longer be changed.";
  return null;
};

const row = (e, attempts = 0) => ({
  id: String(e._id), title: e.title, subject: e.subject, level: e.level, examType: e.examType, status: e.status,
  durationMinutes: e.durationMinutes, maxAttempts: e.maxAttempts, questionCount: (e.questions || []).length,
  totalMarks: (e.questions || []).reduce((n, q) => n + (q.marks ?? 1), 0), attempts, updatedAt: e.updatedAt,
});

exports.list = async (req, res) => {
  try {
    const exams = await Exam.find().sort({ updatedAt: -1 }).lean();
    const counts = await Attempt.aggregate([{ $match: { status: "submitted" } }, { $group: { _id: "$examId", n: { $sum: 1 } } }]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ exams: exams.map((e) => row(e, byId.get(String(e._id)) || 0)) });
  } catch (err) { serverError(res, err); }
};

exports.create = async (req, res) => {
  try {
    const exam = await Exam.create({ ...clean(req.body), createdBy: req.user.id, status: "draft" });
    res.status(201).json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.get = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const locked = await lockedReason(exam);
    res.json({ exam, locked });
  } catch (err) { serverError(res, err); }
};

exports.update = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    exam.set(clean(req.body));
    await exam.save();
    res.json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.remove = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    if (await Attempt.exists({ examId: exam._id })) return res.status(409).json({ error: "This examination has attempts and cannot be deleted. Unpublish it instead." });
    await exam.deleteOne();
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
};

exports.addQuestion = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const locked = await lockedReason(exam);
    if (locked) return res.status(409).json({ error: locked });
    if (exam.questions.length >= MAX_QUESTIONS) return res.status(400).json({ error: `An examination can have at most ${MAX_QUESTIONS} questions.` });
    exam.questions.push(req.body);
    await exam.save();
    res.status(201).json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.importQuestions = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const locked = await lockedReason(exam);
    if (locked) return res.status(409).json({ error: locked });

    const { questions, errors } = parseQuestionText(req.body.text);
    // All or nothing: a paste with any problem imports nothing, so no question is ever half-imported or guessed.
    if (errors.length) return res.status(400).json({ error: "Nothing was imported. Fix the problems below and try again.", errors, valid: questions.length });
    if (!questions.length) return res.status(400).json({ error: "No questions were found in the text." });
    if (exam.questions.length + questions.length > MAX_QUESTIONS) return res.status(400).json({ error: `An examination can have at most ${MAX_QUESTIONS} questions.` });
    exam.questions.push(...questions);
    await exam.save();
    res.status(201).json({ imported: questions.length, exam });
  } catch (err) { serverError(res, err); }
};

exports.updateQuestion = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const locked = await lockedReason(exam);
    if (locked) return res.status(409).json({ error: locked });
    const q = exam.questions.id(req.params.qid);
    if (!q) return res.status(404).json({ error: "Question not found" });
    q.set(req.body);
    await exam.save();
    res.json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.removeQuestion = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const locked = await lockedReason(exam);
    if (locked) return res.status(409).json({ error: locked });
    const q = exam.questions.id(req.params.qid);
    if (!q) return res.status(404).json({ error: "Question not found" });
    q.deleteOne();
    await exam.save();
    res.json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.publish = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    if (!exam.questions.length) return res.status(400).json({ error: "Add at least one question before publishing." });
    exam.status = "published";
    await exam.save();
    res.json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.unpublish = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    exam.status = "draft"; // attempts already made are kept
    await exam.save();
    res.json({ exam });
  } catch (err) { serverError(res, err); }
};

exports.attempts = async (req, res) => {
  try {
    const exam = await find(req, res);
    if (!exam) return;
    const attempts = await Attempt.find({ examId: exam._id }).sort({ createdAt: -1 }).limit(500).lean();
    const users = await User.find({ _id: { $in: attempts.map((a) => a.userId) } }).select("firstName lastName studentId email").lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json({
      attempts: attempts.map((a) => {
        const u = byId.get(String(a.userId)) || {};
        return {
          id: String(a._id), student: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown", studentId: u.studentId || "",
          status: a.status, startedAt: a.startedAt, submittedAt: a.submittedAt, autoSubmitted: a.autoSubmitted,
          score: a.score, totalMarks: a.totalMarks, percentage: a.percentage,
        };
      }),
    });
  } catch (err) { serverError(res, err); }
};
