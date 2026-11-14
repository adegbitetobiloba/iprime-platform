const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const User = require("../models/User");
const { buildExamCohort } = require("../utils/cohortAnalytics");
const { buildResultRows, COLUMNS, exportAuditEntry, EXPORT_ENTITY } = require("../utils/cohortExport");
const { toCsv, safeFilename } = require("../utils/csv");
const { audit } = require("../utils/audit");
const AuditLog = require("../models/AuditLog");

// GET /api/admin/analytics/exams/:examId  (administrators only; see the router)
// Names are limited to first name, last name and student ID. No contact, guardian, medical or payment fields are read.
exports.examCohort = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) return res.status(400).json({ error: "Invalid examination id." });
    const exam = await Exam.findById(examId).lean();
    if (!exam) return res.status(404).json({ error: "Examination not found." });

    const attempts = await Attempt.find({ examId, status: "submitted" })
      .select("userId status startedAt submittedAt autoSubmitted answers questionIds score totalMarks percentage correct incorrect unanswered")
      .sort({ submittedAt: 1 }).limit(5000).lean();
    const data = buildExamCohort({ exam, attempts });

    const ids = [...new Set([...data.top, ...data.support].map((r) => r.userId))];
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName studentId").lean() : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const named = (r) => { const u = byId.get(r.userId); return { ...r, name: u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "Former student", studentId: u?.studentId || null }; };

    res.json({ generatedAt: new Date().toISOString(), truncated: attempts.length === 5000, ...data, top: data.top.map(named), support: data.support.map(named) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};

// GET /api/admin/analytics/exams/:examId/export.csv  (administrators only)
// One row per student (first submitted attempt). Exporting results is a sensitive action: it is restricted to admins
// and never includes contact, guardian, medical or payment data. An audit-log entry is added once the Admin
// workstream's AuditLog model exists (see docs/ANALYTICS.md).
exports.examCsv = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) return res.status(400).json({ error: "Invalid examination id." });
    const exam = await Exam.findById(examId).select("title subject").lean();
    if (!exam) return res.status(404).json({ error: "Examination not found." });

    const attempts = await Attempt.find({ examId, status: "submitted" })
      .select("userId status submittedAt autoSubmitted score totalMarks percentage correct incorrect unanswered")
      .sort({ submittedAt: 1 }).limit(5000).lean();
    const ids = [...new Set(attempts.map((a) => String(a.userId)))];
    const users = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName studentId").lean() : [];

    const rows = buildResultRows({ attempts, users });
    // Record the export BEFORE sending anything. If the audit entry cannot be written the download is refused,
    // so no export can happen without a trace. (The entry and the file are not one transaction.)
    await audit(req, exportAuditEntry({ exam: { ...exam, _id: examId }, rowCount: rows.length, truncated: attempts.length === 5000 }));

    const day = new Date().toISOString().slice(0, 10);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(exam.title)}-results-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(toCsv(rows, COLUMNS));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};

// GET /api/admin/analytics/exports  (administrators only): the most recent result exports, for accountability.
exports.recentExports = async (req, res) => {
  try {
    const entries = await AuditLog.find({ entityType: EXPORT_ENTITY }).sort({ at: -1 }).limit(20).lean();
    const ids = [...new Set(entries.map((e) => String(e.actorId)).filter(Boolean))];
    const people = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName").lean() : [];
    const byId = new Map(people.map((u) => [String(u._id), [u.firstName, u.lastName].filter(Boolean).join(" ")]));
    res.json({
      exports: entries.map((e) => ({ id: String(e._id), at: e.at, examId: e.entityId, examTitle: e.meta?.examTitle || "Examination", rows: e.meta?.rowCount ?? 0, by: byId.get(String(e.actorId)) || "Former staff member", role: e.actorRole || null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};
