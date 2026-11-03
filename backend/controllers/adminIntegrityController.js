const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const AttemptEvent = require("../models/AttemptEvent");
const User = require("../models/User");
const { normalizePolicy } = require("../utils/guard");
const { summarise } = require("../utils/integritySummary");

const isId = (v) => mongoose.isValidObjectId(v);
const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

// GET /api/admin/integrity/exams/:id : one row per attempt, with the integrity facts an administrator needs to review.
exports.exam = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Examination not found" });
    const exam = await Exam.findById(req.params.id).select("title guard").lean();
    if (!exam) return res.status(404).json({ error: "Examination not found" });
    const attempts = await Attempt.find({ examId: exam._id }).sort({ createdAt: -1 }).limit(500).lean();
    const users = await User.find({ _id: { $in: attempts.map((a) => a.userId) } }).select("firstName lastName studentId").lean();
    const byUser = new Map(users.map((u) => [String(u._id), u]));

    const sums = await AttemptEvent.aggregate([
      { $match: { examId: exam._id, attemptId: { $in: attempts.map((a) => a._id) } } },
      { $group: { _id: { a: "$attemptId", t: "$type" }, n: { $sum: 1 }, ms: { $sum: { $ifNull: ["$durationMs", 0] } } } },
    ]);
    const byAttempt = new Map();
    for (const s of sums) {
      const k = String(s._id.a);
      const o = byAttempt.get(k) || { counts: {}, awayMs: 0 };
      o.counts[s._id.t] = s.n;
      if (s._id.t === "away") o.awayMs += s.ms;
      byAttempt.set(k, o);
    }

    const rows = attempts.map((a) => {
        const u = byUser.get(String(a.userId)) || {};
        const ev = byAttempt.get(String(a._id)) || { counts: {}, awayMs: 0 };
        return {
          id: String(a._id),
          student: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown",
          studentId: u.studentId || "",
          status: a.status, startedAt: a.startedAt, submittedAt: a.submittedAt,
          autoSubmitted: Boolean(a.autoSubmitted), submitReason: a.submitReason || null,
          score: a.score, totalMarks: a.totalMarks, percentage: a.percentage,
          violations: a.violations || 0, maxViolations: normalizePolicy(a.guard || exam.guard).maxViolations,
          lateSynced: Boolean(a.lateSynced), lateSyncedCount: a.lateSyncedCount || 0, lateSyncRejected: a.lateSyncRejected || 0,
          saves: a.saveCount || 0,
          awaySeconds: Math.round(ev.awayMs / 1000),
          counts: ev.counts,
        };
      });
    res.json({ exam: { id: String(exam._id), title: exam.title, guard: normalizePolicy(exam.guard) }, summary: summarise(rows), attempts: rows });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/integrity/attempts/:id/events : the timeline of one attempt (oldest first).
exports.events = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Attempt not found" });
    const attempt = await Attempt.findById(req.params.id).lean();
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const events = await AttemptEvent.find({ attemptId: attempt._id }).sort({ at: 1 }).limit(1500).lean();
    res.json({
      attempt: { id: String(attempt._id), status: attempt.status, startedAt: attempt.startedAt, deadline: attempt.deadline, submittedAt: attempt.submittedAt, submitReason: attempt.submitReason || null, violations: attempt.violations || 0, lateSynced: Boolean(attempt.lateSynced) },
      events: events.map((e) => ({ id: String(e._id), type: e.type, source: e.source, at: e.at, clientAt: e.clientAt, durationMs: e.durationMs, counted: Boolean(e.counted), meta: e.meta })),
    });
  } catch (err) { serverError(res, err); }
};
