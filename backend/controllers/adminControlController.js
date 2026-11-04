const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const AttemptEvent = require("../models/AttemptEvent");
const User = require("../models/User");
const { makeFinaliser } = require("../utils/attemptLifecycle");
const { makeLogger } = require("../utils/attemptEvents");
const { makeControl, connectionOf, remainingSeconds, ACTIVE_SECONDS, QUIET_SECONDS } = require("../utils/examControl");
const { normalizePolicy } = require("../utils/guard");

const isId = (v) => mongoose.isValidObjectId(v);
const logger = makeLogger(AttemptEvent);
const finalise = makeFinaliser(Attempt, {
  onClosed: (a, info) => logger.log(a, "closed_by_admin", { reason: info.reason }),
});
const control = makeControl({ Attempt, finalise, logger });

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
const MESSAGES = {
  NOT_RUNNING: "This attempt is no longer in progress.",
  ALREADY_PAUSED: "This attempt is already paused.",
  NOT_PAUSED: "This attempt is not paused.",
  TIME_UP: "This attempt has already run out of time.",
  LIMIT: "That would add more than 4 hours in total to this attempt.",
  BAD_MINUTES: "Choose a whole number of minutes from 1 to 120.",
  CHANGED: "The attempt changed while you were doing that. Refresh and try again.",
};
const refuse = (res, r) => res.status(409).json({ error: MESSAGES[r.code] || "Could not do that.", code: r.code });

async function load(req, res) {
  if (!isId(req.params.id)) { res.status(404).json({ error: "Attempt not found" }); return null; }
  const attempt = await Attempt.findById(req.params.id).lean();
  if (!attempt) { res.status(404).json({ error: "Attempt not found" }); return null; }
  return attempt;
}

// One row per running attempt, with what an invigilator needs: connection, progress, time left, warnings.
async function liveRows(filter, now = new Date()) {
  const attempts = await Attempt.find({ status: "in_progress", ...filter }).sort({ startedAt: 1 }).limit(500).lean();
  const users = await User.find({ _id: { $in: attempts.map((a) => a.userId) } }).select("firstName lastName studentId").lean();
  const byUser = new Map(users.map((u) => [String(u._id), u]));
  const exams = await Exam.aggregate([
    { $match: { _id: { $in: [...new Set(attempts.map((a) => String(a.examId)))].map((x) => new mongoose.Types.ObjectId(x)) } } },
    { $project: { title: 1, guard: 1, n: { $size: { $ifNull: ["$questions", []] } } } },
  ]);
  const byExam = new Map(exams.map((e) => [String(e._id), e]));
  return attempts.map((a) => {
    const u = byUser.get(String(a.userId)) || {};
    const e = byExam.get(String(a.examId)) || {};
    const total = a.totalQuestions ?? (Array.isArray(a.questionIds) && a.questionIds.length ? a.questionIds.length : e.n || 0);
    return {
      id: String(a._id), examId: String(a.examId), examTitle: e.title || "",
      student: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown", studentId: u.studentId || "",
      connection: connectionOf(a, now),
      lastSignalSeconds: Math.max(0, Math.round((now.getTime() - Math.max(...[a.lastSeenAt, a.lastSavedAt, a.startedAt].filter(Boolean).map((x) => new Date(x).getTime()))) / 1000)),
      answered: a.answers ? Object.keys(a.answers instanceof Map ? Object.fromEntries(a.answers) : a.answers).length : 0,
      total,
      remainingSeconds: remainingSeconds(a, now),
      paused: Boolean(a.pausedAt), pauseCount: a.pauseCount || 0, extraMinutes: Math.round((a.extraSeconds || 0) / 60),
      violations: a.violations || 0, maxViolations: normalizePolicy(a.guard || e.guard).maxViolations,
      pendingCommand: a.adminCommand && a.adminCommand.type ? a.adminCommand.type : null,
      startedAt: a.startedAt,
    };
  });
}

// GET /api/admin/integrity/control/exams/:id/live
exports.live = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Examination not found" });
    const examId = new mongoose.Types.ObjectId(req.params.id);
    const rows = await liveRows({ examId });
    const counts = { online: 0, quiet: 0, disconnected: 0, paused: 0 };
    for (const r of rows) counts[r.connection]++;
    res.json({ generatedAt: new Date().toISOString(), counts, definitions: { activeSeconds: ACTIVE_SECONDS, quietSeconds: QUIET_SECONDS }, attempts: rows });
  } catch (err) { serverError(res, err); }
};

const by = (req) => req.user.id;
const reasonOf = (req) => (req.body && req.body.reason ? String(req.body.reason).slice(0, 200) : undefined);

exports.pause = async (req, res) => { try { const a = await load(req, res); if (!a) return; const r = await control.pause(a, by(req), reasonOf(req)); return r.ok ? res.json({ ok: true }) : refuse(res, r); } catch (e) { serverError(res, e); } };
exports.resume = async (req, res) => { try { const a = await load(req, res); if (!a) return; const r = await control.resume(a, by(req)); return r.ok ? res.json({ ok: true }) : refuse(res, r); } catch (e) { serverError(res, e); } };
exports.extend = async (req, res) => { try { const a = await load(req, res); if (!a) return; const r = await control.extend(a, req.body.minutes, by(req), reasonOf(req)); return r.ok ? res.json({ ok: true }) : refuse(res, r); } catch (e) { serverError(res, e); } };

// mode "ask": the student's screen is told to submit (answers still on the device are sent first). mode "now": immediate.
exports.forceSubmit = async (req, res) => {
  try {
    const a = await load(req, res); if (!a) return;
    if (req.body.mode === "now") {
      const exam = await Exam.findById(a.examId).lean();
      if (!exam) return res.status(404).json({ error: "Examination not found" });
      const r = await control.closeNow(a, exam, by(req), "force", reasonOf(req));
      return r.ok ? res.json({ ok: true }) : refuse(res, r);
    }
    const r = await control.requestSubmit(a, by(req), reasonOf(req));
    return r.ok ? res.json({ ok: true }) : refuse(res, r);
  } catch (e) { serverError(res, e); }
};

exports.terminate = async (req, res) => {
  try {
    const a = await load(req, res); if (!a) return;
    const exam = await Exam.findById(a.examId).lean();
    if (!exam) return res.status(404).json({ error: "Examination not found" });
    const r = await control.closeNow(a, exam, by(req), "terminate", reasonOf(req));
    return r.ok ? res.json({ ok: true }) : refuse(res, r);
  } catch (e) { serverError(res, e); }
};

// Whole-room actions (for example a power cut or a fire drill): the same guarded action on every running attempt of one exam.
async function everyone(req, res, fn) {
  if (!isId(req.params.id)) return res.status(404).json({ error: "Examination not found" });
  const attempts = await Attempt.find({ examId: req.params.id, status: "in_progress" }).limit(1000).lean();
  let done = 0, skipped = 0;
  for (const a of attempts) { const r = await fn(a); if (r.ok) done++; else skipped++; }
  res.json({ ok: true, done, skipped });
}
exports.pauseAll = async (req, res) => { try { await everyone(req, res, (a) => control.pause(a, by(req), reasonOf(req))); } catch (e) { serverError(res, e); } };
exports.resumeAll = async (req, res) => { try { await everyone(req, res, (a) => control.resume(a, by(req))); } catch (e) { serverError(res, e); } };
exports.extendAll = async (req, res) => { try { await everyone(req, res, (a) => control.extend(a, req.body.minutes, by(req), reasonOf(req))); } catch (e) { serverError(res, e); } };
