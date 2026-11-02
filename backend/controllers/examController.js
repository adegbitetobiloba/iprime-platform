const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const { deadlineFor, toPlain } = require("../utils/cbt");
const { newSeed, arrange, studentView, reviewView } = require("../utils/randomise");
const pool = require("../utils/pool");
const AttemptEvent = require("../models/AttemptEvent");
const { makeFinaliser } = require("../utils/attemptLifecycle");
const { graceSecondsFromEnv, phaseOf, makeSyncer } = require("../utils/lateSync");
const { normalizePolicy } = require("../utils/guard");
const { makeLogger, makeEventService } = require("../utils/attemptEvents");

const isId = (v) => mongoose.isValidObjectId(v);
const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

const isOpen = (exam, at = new Date()) =>
  exam.status === "published" && (!exam.availableFrom || exam.availableFrom <= at) && (!exam.availableUntil || exam.availableUntil >= at);

const totalMarks = (exam) => exam.questions.reduce((n, q) => n + (q.marks ?? 1), 0);

// The activity log (utils/attemptEvents.js): server-side entries for start, resume, submission and so on.
const logger = makeLogger(AttemptEvent);
// Scores and closes an attempt. Safe to call twice, and safe against a save arriving mid-way: see utils/attemptLifecycle.js.
// Every close is written to the activity log, with the reason (student, time_up, violation_limit).
const finalise = makeFinaliser(Attempt, {
  onClosed: (a, info) => logger.log(a, info.reason === "violation_limit" ? "auto_submitted_violations" : info.auto ? "auto_submitted_time" : "submitted", { reason: info.reason }),
});
// Violation counting and the client activity reports (ExamGuard).
const eventService = makeEventService({ Attempt, AttemptEvent, finalise });
// Applies what an offline student's device still holds (within the grace period), then closes: see utils/lateSync.js.
const syncer = makeSyncer({ Attempt, finalise });

const summary = (a, exam) => ({
  id: String(a._id),
  examId: String(a.examId),
  examTitle: exam?.title,
  subject: exam?.subject,
  status: a.status,
  startedAt: a.startedAt,
  submittedAt: a.submittedAt,
  autoSubmitted: a.autoSubmitted,
  submitReason: a.submitReason, // student | time_up | violation_limit
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
    closeAt: attempt.closeAt || attempt.deadline, // end of the reconnection grace period (same as deadline when there is none)
    timeUp: phaseOf(attempt) !== "open",           // true when the student is inside the grace period (reopened after the deadline)
    answers: toPlain(attempt.answers),
    flagged: attempt.flagged || [],
    guard: normalizePolicy(attempt.guard || exam.guard), // what the exam screen should monitor and warn about
    violations: attempt.violations || 0,
    serverNow: new Date().toISOString(),
  },
  exam: { id: String(exam._id), title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes, instructions: exam.instructions || "" },
  // Each attempt has its own order (when the exam asks for it). Same attempt, same order, every time.
  questions: arrange(exam.questions, attempt).map(studentView),
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
          durationMinutes: e.durationMinutes, questionCount: pool.shape(e).questionCount, totalMarks: totalMarks(e), maxAttempts: e.maxAttempts,
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
        instructions: e.instructions, durationMinutes: e.durationMinutes, questionCount: pool.shape(e).questionCount, totalMarks: totalMarks(e),
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
    if (existing && phaseOf(existing) === "ended") {
      await finalise(existing, exam, true); // the closing time passed while the student was away
      existing = null;
    }
    if (existing) {
      logger.log(existing, "exam_resumed", { sinceLastSaveSeconds: Math.round((Date.now() - new Date(existing.lastSavedAt || existing.startedAt).getTime()) / 1000) });
      return res.json(runningPayload(existing, exam)); // resume (also inside the grace period): the deadline does not change
    }

    if (!isOpen(exam)) return res.status(403).json({ error: "This examination is not open right now." });
    if (!exam.questions.length) return res.status(409).json({ error: "This examination has no questions yet." });
    const used = await Attempt.countDocuments({ examId: exam._id, userId: req.user.id, status: "submitted" });
    if (used >= exam.maxAttempts) return res.status(403).json({ error: "You have used all your attempts for this examination." });

    const startedAt = new Date();
    const deadline = deadlineFor(startedAt, exam.durationMinutes);
    const graceSeconds = graceSecondsFromEnv(); // copied onto the attempt, so changing it later never alters a running exam
    try {
      // The switches are copied onto the attempt now, so editing the exam later can never reshuffle a student mid-exam.
      const created = await Attempt.create({
        examId: exam._id, userId: req.user.id, startedAt, deadline,
        graceSeconds, closeAt: new Date(new Date(deadline).getTime() + graceSeconds * 1000),
        guard: normalizePolicy(exam.guard), // fixed now: editing the exam later never changes a running attempt
        ...(await pool.planAttempt(Attempt, exam, req.user.id)),
      });
      logger.log(created, "exam_started", { durationMinutes: exam.durationMinutes });
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
    if (attempt.status === "in_progress" && phaseOf(attempt) === "ended") attempt = await finalise(attempt, exam, true);
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
    const phase = phaseOf(attempt);
    if (phase === "ended") {
      await finalise(attempt, exam, true);
      return res.status(409).json({ error: "Time is up. Your attempt was submitted.", code: "EXPIRED" });
    }
    // After the deadline but inside the grace period: a plain save is refused (it could not be told apart from a late
    // answer). The exam screen sends everything it holds through /sync instead, where timestamps are checked.
    if (phase === "grace") return res.status(409).json({ error: "Time is up. Your answers will be sent when you submit.", code: "TIME_UP" });

    const { questionId, choice, flagged } = req.body;
    const question = pool.servedQuestions(exam, attempt).find((q) => String(q._id) === questionId);
    if (!question) return res.status(400).json({ error: "Unknown question" });
    if (choice && !question.options.some((o) => o.key === choice)) return res.status(400).json({ error: "That option does not exist for this question" });

    const update = { $inc: { rev: 1, saveCount: 1 }, $set: { lastSavedAt: new Date() } }; // every save moves rev, so closing the attempt can detect a save that raced it
    if (choice !== undefined) {
      if (choice === null) update.$unset = { [`answers.${questionId}`]: "" };
      else update.$set[`answers.${questionId}`] = choice;
    }
    if (flagged !== undefined) {
      if (flagged) update.$addToSet = { flagged: questionId };
      else update.$pull = { flagged: questionId };
    }

    // The deadline is checked inside the database update itself, so a save can never land after time is up.
    const r = await Attempt.updateOne({ _id: attempt._id, userId: req.user.id, status: "in_progress", deadline: { $gt: new Date() } }, update);
    if (r.matchedCount === 0) {
      const cur = await Attempt.findById(attempt._id).lean(); // the deadline passed a moment ago, or it was submitted
      const code = cur && cur.status === "in_progress" && phaseOf(cur) === "grace" ? "TIME_UP" : "EXPIRED";
      return res.status(409).json({ error: "Time is up or the attempt was submitted.", code });
    }
    res.json({ saved: true, serverNow: new Date().toISOString() });
  } catch (err) { serverError(res, err); }
};

// POST /api/attempts/:id/sync  { answers: [{ questionId, choice?, flagged?, answeredAt }] }
// The exam screen submits through this: it sends whatever the server has not confirmed yet, then closes the attempt.
// Before the deadline everything is accepted. In the grace period only answers given before the deadline are.
exports.syncAttempt = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });
    const r = await syncer(attempt, exam, req.body.answers || []);
    if (r.outcome === "closed" && r.attempt && r.attempt.lateSynced) logger.log(r.attempt, "answers_synced_late", { accepted: r.accepted, rejected: r.rejected.length });
    res.json({
      result: summary(r.attempt, exam),
      accepted: r.accepted,
      rejected: r.rejected.length,
      graceEnded: r.outcome === "grace_ended",
      alreadySubmitted: r.outcome === "already_submitted",
    });
  } catch (err) { serverError(res, err); }
};

// POST /api/attempts/:id/events  { events: [{ eid, type, at?, durationMs?, reasons? }] }
// ExamGuard reports from the student's browser. The server decides what counts as a violation and ends the exam when the
// exam's limit is reached (if that exam has automatic submission on). See utils/guard.js for what can and cannot be detected.
exports.recordEvents = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });
    const r = await eventService.ingest(attempt, exam, req.body.events);
    res.json({
      violations: r.violations, max: r.max, remaining: r.remaining ?? 0,
      closed: Boolean(r.closed), terminated: Boolean(r.terminated),
      ...(r.attempt ? { result: summary(r.attempt, exam) } : {}),
    });
  } catch (err) { serverError(res, err); }
};

// POST /api/attempts/:id/submit
exports.submitAttempt = async (req, res) => {
  try {
    const attempt = await ownAttempt(req);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return res.status(404).json({ error: "Attempt not found" });
    const done = attempt.status === "submitted" ? attempt : await finalise(attempt, exam, new Date(attempt.deadline) <= new Date());
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
      out.review = arrange(exam.questions, attempt).map((entry) => reviewView(entry, given)); // the order and letters the student saw
    }
    res.json(out);
  } catch (err) { serverError(res, err); }
};
