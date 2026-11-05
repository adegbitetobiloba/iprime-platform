// Examiner view of student attempts: a searchable list, and the full paper ONE student was given.
// Admin only (see routes/adminRoutes.js). Read-only: nothing here changes an attempt.
const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const User = require("../models/User");
const Guest = require("../models/Guest");
const { arrange, reviewView } = require("../utils/randomise");
const { toPlain } = require("../utils/cbt");

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong on our side. Please try again." }); };
const guestOf = (g) => ({ id: String(g._id), name: `${g.name} (guest)`, studentId: "Guest", email: g.contact || null });
const personOf = (u) => (u ? { id: String(u._id), name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || "Unknown", studentId: u.studentId || null, email: u.email || null } : { id: null, name: "Deleted account", studentId: null, email: null });

// GET /api/admin/attempts?exam=&status=&q=&page=&limit=
exports.list = async (req, res) => {
  try {
    const { exam, status, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = {};
    if (exam) { if (!mongoose.isValidObjectId(exam)) return res.status(400).json({ error: "That examination id is not valid." }); filter.examId = exam; }
    if (["in_progress", "submitted"].includes(status)) filter.status = status;
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRx(String(q).trim().slice(0, 60)), "i");
      const people = await User.find({ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { studentId: rx }] }).select("_id").limit(300).lean();
      filter.userId = { $in: people.map((p) => p._id) };
    }
    const [total, rows] = await Promise.all([
      Attempt.countDocuments(filter),
      Attempt.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    const ids = [...new Set(rows.map((r) => String(r.userId)))];
    const [users, guests, exams] = await Promise.all([
      User.find({ _id: { $in: ids } }).select("firstName lastName studentId email").lean(),
      Guest.find({ _id: { $in: ids } }).lean(),
      Exam.find({ _id: { $in: [...new Set(rows.map((r) => String(r.examId)))] } }).select("title subject").lean(),
    ]);
    const gById = new Map(guests.map((g) => [String(g._id), g]));
    const uById = new Map(users.map((u) => [String(u._id), u])), eById = new Map(exams.map((e) => [String(e._id), e]));
    res.json({
      total, page, pages: Math.max(1, Math.ceil(total / limit)), limit,
      attempts: rows.map((a) => {
        const ex = eById.get(String(a.examId));
        return {
          id: String(a._id), student: uById.has(String(a.userId)) ? personOf(uById.get(String(a.userId))) : gById.has(String(a.userId)) ? guestOf(gById.get(String(a.userId))) : personOf(null),
          exam: { id: String(a.examId), title: ex ? ex.title : "Deleted examination", subject: ex ? ex.subject : "" },
          status: a.status, startedAt: a.startedAt, submittedAt: a.submittedAt || null, autoSubmitted: Boolean(a.autoSubmitted),
          answered: Object.keys(toPlain(a.answers) || {}).length, drawn: Array.isArray(a.questionIds) && a.questionIds.length > 0,
          questionCount: a.questionCount ?? null, score: a.score ?? null, totalMarks: a.totalMarks ?? null, percentage: a.percentage ?? null,
          correct: a.correct ?? null, incorrect: a.incorrect ?? null, unanswered: a.unanswered ?? null,
        };
      }),
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/attempts/:id : the paper this student was actually given, in the order and with the letters they saw.
exports.detail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Attempt not found" });
    const attempt = await Attempt.findById(id).lean();
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const [exam, user, guest] = await Promise.all([
      Exam.findById(attempt.examId).lean(),
      User.findById(attempt.userId).select("firstName lastName studentId email").lean(),
      Guest.findById(attempt.userId).lean(),
    ]);
    if (!exam) return res.status(404).json({ error: "The examination for this attempt no longer exists." });
    const given = toPlain(attempt.answers) || {};
    const flagged = new Set((attempt.flagged || []).map(String));
    const questions = arrange(exam.questions, attempt).map((entry) => {
      const v = reviewView(entry, given);
      return { ...v, number: undefined, answered: Boolean(v.yourChoice), correct: v.yourChoice ? v.yourChoice === v.correctKey : null, flagged: flagged.has(v.id), topic: entry.q.topic || "", subject: entry.q.subject || "", difficulty: entry.q.difficulty || null, optionsReordered: entry.moved };
    });
    const end = attempt.submittedAt ? new Date(attempt.submittedAt) : new Date();
    res.json({
      attempt: {
        id: String(attempt._id), status: attempt.status, startedAt: attempt.startedAt, deadline: attempt.deadline, submittedAt: attempt.submittedAt || null,
        autoSubmitted: Boolean(attempt.autoSubmitted), timeUsedSeconds: Math.max(0, Math.round((end - new Date(attempt.startedAt)) / 1000)),
        score: attempt.score ?? null, totalMarks: attempt.totalMarks ?? null, percentage: attempt.percentage ?? null,
        correct: attempt.correct ?? null, incorrect: attempt.incorrect ?? null, unanswered: attempt.unanswered ?? null,
        shuffledQuestions: Boolean(attempt.shuffleQuestions && attempt.seed), shuffledOptions: Boolean(attempt.shuffleOptions && attempt.seed),
      },
      student: user ? personOf(user) : guest ? guestOf(guest) : personOf(null),
      exam: { id: String(exam._id), title: exam.title, subject: exam.subject, poolSize: (exam.questions || []).length, questionsPerStudent: exam.questionsPerStudent || null },
      drawn: Array.isArray(attempt.questionIds) && attempt.questionIds.length > 0,
      questions,
    });
  } catch (err) { serverError(res, err); }
};
