const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const { scoreAttempt, publicQuestion, deadlineFor, toPlain } = require("../utils/cbt");

const isId = (v) => mongoose.isValidObjectId(v);
const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

const isOpen = (exam, at = new Date()) =>
  exam.status === "published" && (!exam.availableFrom || exam.availableFrom <= at) && (!exam.availableUntil || exam.availableUntil >= at);

const totalMarks = (exam) => exam.questions.reduce((n, q) => n + (q.marks ?? 1), 0);

// Scores and closes an attempt. Safe to call twice: only an attempt that is still in progress can be closed,
// and scoring is deterministic, so concurrent calls cannot produce different results.
async function finalise(attempt, exam, auto) {
  const result = scoreAttempt(exam.questions, attempt.answers);
  await Attempt.updateOne(
    { _id: attempt._id, status: "in_progress" },
    { $set: { status: "submitted", submittedAt: new Date(), autoSubmitted: Boolean(auto), questionCount: exam.questions.length, ...result } }
  );
  return Attempt.findById(attempt._id).lean();
}

const summary = (a, exam) => ({
  id: String(a._id),
  examId: String(a.examId),
  examTitle: exam?.title,
  subject: exam?.subject,
  status: a.status,
  startedAt: a.startedAt,
  submittedAt: a.submittedAt,
  autoSubmitted: a.autoSubmitted,
  questionCount: a.questionCount,
  score: a.score,
  totalMarks: a.totalMarks,
  percentage: a.percentage,
  correct: a.correct,
  incorrect: a.incorrect,
  unanswered: a.unanswered,
});

// The running exam as the student may see it. No correct answers, no explanations.
const runningPayload = (attempt, exam) => ({
  submitted: false,
  attempt: {
    id: String(attempt._id),
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadline: attempt.deadline,
    answers: toPlain(attempt.answers),
    flagged: attempt.flagged || [],
    serverNow: new Date().toISOString(),
  },
  exam: { id: String(exam._id), title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes, instructions: exam.instructions || "" },
  questions: exam.questions.map(publicQuestion),
});

// Loads an attempt only if it belongs to the signed-in user. Others get "not found", not "forbidden".
async function ownAttempt(req) {
  if (!isId(req.params.id)) return null;
  const attempt = await Attempt.findById(req.params.id).lean();
  if (!attempt || String(attempt.userId) !== String(req.user.id)) return null;
  return attempt;
}

// GET /api/exams
exports.listExams = async (req, res) => {
  try {
    const now = new Date();
    const exams = await Exam.find({ status: "published", $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] }).sort({ createdAt: -1 }).lean();
    const mine = await Attempt.find({ userId: req.user.id, examId: { $in: exams.map((e) => e._id) } }).select("examId status").lean();
    res.json({
      exams: exams.map((e) => {
        const theirs = mine.filter((a) => String(a.examId) === String(e._id));
        const inProgress = theirs.find((a) => a.status === "in_progress");
        return {
          id: String(e._id), title: e.title, description: e.description, subject: e.subject, level: e.level, examType: e.examType,
          durationMinutes: e.durationMinutes, questionCount: e.questions.length, totalMarks: totalMarks(e), maxAttempts: e.maxAttempts,
          availableFrom: e.availableFrom, availableUntil: e.availableUntil,
          attemptsUsed: theirs.filter((a) => a.status === "submitted").length,
          inProgressAttemptId: inProgress ? String(inProgress._id) : null,
          open: isOpen(e, now),
        };
      }),
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/exams/:id  (details and instructions only: no questions)
exports.getExam = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Examination not found" });
    const e = await Exam.findById(req.params.id).lean();
    if (!e || e.status !== "published") return res.status(404).json({ error: "Examination not found" });
    const mine = await Attempt.find({ userId: req.user.id, examId: e._id }).select("status").lean();
    const inProgress = mine.find((a) => a.status === "in_progress");
    res.json({
      exam: {
        id: String(e._id), title: e.title, description: e.description, subject: e.subject, level: e.level, examType: e.examType,
        instructions: e.instructions, durationMinutes: e.durationMinutes, questionCount: e.questions.length, totalMarks: totalMarks(e),
        maxAttempts: e.maxAttempts, availableFrom: e.availableFrom, availableUntil: e.availableUntil,
        attemptsUsed: mine.filter((a) => a.status === "submitted").length,
        inProgressAttemptId: inProgress ? String(inProgress._id) : null,
        open: isOpen(e),
      },
    });
  } catch (err) { serverError(res, err); }
};

// POST /api/exams/:id/start  (starts a new attempt, or resumes the one in progress)
exports.startAttempt = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Examination not found" });
    const exam = await Exam.findById(req.params.id).lean();
    if (!exam || exam.status !== "published") return res.status(404).json({ error: "Examination not found" });

    let existing = await Attempt.findOne({ examId: exam._id, userId: req.user.id, status: "in_progress" }).lean();
    if (existing && existing.deadline <= new Date()) {
      await finalise(existing, exam, true); // time ran out while the student was away
      existing = null;
    }
    if (existing) return res.json(runningPayload(existing, exam)); // resume: the deadline does not change

    if (!isOpen(exam)) return res.status(403).json({ error: "This examination is not open right now." });
    if (!exam.questions.length) return res.status(409).json({ error: "This examination has no questions yet." });
    const used = await Attempt.countDocuments({ examId: exam._id, userId: req.user.id, status: "submitted" });
    if (used >= exam.maxAttempts) return res.status(403).json({ error: "You have used all your attempts for this examination." });

    const startedAt = new Date();
    try {
      const created = await Attempt.create({ examId: exam._id, userId: req.user.id, startedAt, deadline: deadlineFor(startedAt, exam.durationMinutes) });
      return res.status(201).json(runningPayload(created.toObject(), exam));
    } catch (err) {
      if (err.code === 11000) { // two start requests at once: use the one that won
        const winner = await Attempt.findOne({ examId: exam._id, userId: req.user.id, status: "in_progress" }).lean();
        if (winner) return res.json(runningPayload(winner, exam));
      }
      throw err;
    }
  } catch (err) { serverError(res, err); }
};

// GET /api/attempts/:id  (used to resume after a refresh)
exports.getAttempt = async (req, res) => {
  try {
    let attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.status === "in_progress" && attempt.deadline <= new Date()) attempt = await finalise(attempt, exam, true);
    if (attempt.status === "submitted") return res.json({ submitted: true, result: summary(attempt, exam) });
    res.json(runningPayload(attempt, exam));
  } catch (err) { serverError(res, err); }
};

// PUT /api/attempts/:id/answers  { questionId, choice?, flagged? }
exports.saveAnswer = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });

    if (attempt.status !== "in_progress") return res.status(409).json({ error: "This attempt has already been submitted.", code: "SUBMITTED" });
    if (attempt.deadline <= new Date()) {
      await finalise(attempt, exam, true);
      return res.status(409).json({ error: "Time is up. Your attempt was submitted.", code: "EXPIRED" });
    }

    const { questionId, choice, flagged } = req.body;
    const question = exam.questions.find((q) => String(q._id) === questionId);
    if (!question) return res.status(400).json({ error: "Unknown question" });
    if (choice && !question.options.some((o) => o.key === choice)) return res.status(400).json({ error: "That option does not exist for this question" });

    const update = {};
    if (choice !== undefined) {
      if (choice === null) update.$unset = { [`answers.${questionId}`]: "" };
      else update.$set = { [`answers.${questionId}`]: choice };
    }
    if (flagged !== undefined) {
      if (flagged) update.$addToSet = { flagged: questionId };
      else update.$pull = { flagged: questionId };
    }

    // The deadline is checked inside the database update itself, so a save can never land after time is up.
    const r = await Attempt.updateOne({ _id: attempt._id, userId: req.user.id, status: "in_progress", deadline: { $gt: new Date() } }, update);
    if (r.matchedCount === 0) return res.status(409).json({ error: "Time is up or the attempt was submitted.", code: "EXPIRED" });
    res.json({ saved: true, serverNow: new Date().toISOString() });
  } catch (err) { serverError(res, err); }
};

// POST /api/attempts/:id/submit
exports.submitAttempt = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });
    const done = attempt.status === "submitted" ? attempt : await finalise(attempt, exam, attempt.deadline <= new Date());
    res.json({ result: summary(done, exam) }); // submitting twice just returns the same stored result
  } catch (err) { serverError(res, err); }
};

// GET /api/attempts  (the student's own history)
exports.history = async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id, status: "submitted" }).sort({ submittedAt: -1 }).limit(100).lean();
    const exams = await Exam.find({ _id: { $in: attempts.map((a) => a.examId) } }).select("title subject").lean();
    const byId = new Map(exams.map((e) => [String(e._id), e]));
    res.json({ attempts: attempts.map((a) => summary(a, byId.get(String(a.examId)))) });
  } catch (err) { serverError(res, err); }
};

// GET /api/attempts/:id/result
exports.result = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Result not found" });
    if (attempt.status !== "submitted") return res.status(409).json({ error: "This attempt is still in progress." });
    const exam = await Exam.findById(attempt.examId).lean();
    const out = { result: summary(attempt, exam), review: null };
    // Correct answers are released only if the administrator allowed it for this exam, and only after submission.
    if (exam && exam.showAnswersAfter) {
      const given = toPlain(attempt.answers);
      out.review = exam.questions.map((q) => ({
        id: String(q._id), text: q.text, textHtml: q.textHtml || undefined, options: q.options.map((o) => ({ key: o.key, text: o.text, html: o.html || undefined })), marks: q.marks ?? 1,
        yourChoice: given[String(q._id)] || null, correctKey: q.correctKey, explanation: q.explanation || "", explanationHtml: q.explanationHtml || undefined, explanationSource: q.explanation ? (q.explanationSource || "source") : null,
      }));
    }
    res.json(out);
  } catch (err) { serverError(res, err); }
};
