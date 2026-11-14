const mongoose = require("mongoose");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const Material = require("../models/LibraryMaterial");
const TeacherGroup = require("../models/TeacherGroup");
const TeacherSubmission = require("../models/TeacherSubmission");
const Enrolment = require("../models/Enrolment");
const { groupFilter } = require("../utils/teacherAccess");
const adminLib = require("./adminLibraryController");
const adminExams = require("./adminExamController");
const publicUser = require("../utils/publicUser");
const { audit } = require("../utils/audit");
const { notifyTeacherApproved, notifyTeacherRejected, notifyTeacherSuspended, notifyTeacherMaterial, notifyTeacherSubmission } = require("../utils/teacherNotify");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SAFE = "firstName lastName email phone state isVerified approval approvalReview teacherProfile createdAt";

// router.param("id"): a bad id is a plain 404, never a crash.
exports.idParam = (req, res, next, id) => (mongoose.isValidObjectId(id) ? next() : bad(res, "Teacher not found", 404));
exports.libIdParam = (req, res, next, id) => (mongoose.isValidObjectId(id) ? next() : bad(res, "Material not found", 404));

const getTeacher = async (id) => {
  const u = await User.findById(id);
  return u && u.role === "teacher" ? u : null;
};

// The approval state an account is in, as an administrator sees it. Teachers with no value predate this feature and need a first review.
const stateOf = (u) => u.approval || "unreviewed";

exports.list = async (req, res) => {
  const filter = { role: "teacher" };
  const s = String(req.query.status || "");
  if (["pending", "approved", "rejected", "suspended"].includes(s)) filter.approval = s;
  else if (s === "unreviewed") filter.approval = { $exists: false };
  const term = String(req.query.q || "").trim().slice(0, 60);
  if (term.length >= 2) { const re = new RegExp(esc(term), "i"); filter.$or = [{ firstName: re }, { lastName: re }, { email: re }]; }

  const teachers = await User.find(filter).select(SAFE).sort({ createdAt: -1 }).limit(200).lean();
  const ids = teachers.map((t) => t._id);
  const counts = ids.length ? await TeacherAssignment.aggregate([{ $match: { teacherId: { $in: ids }, status: "active" } }, { $group: { _id: "$teacherId", n: { $sum: 1 } } }]) : [];
  const n = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  const tally = await Promise.all(["pending", "approved", "rejected", "suspended"].map((a) => User.countDocuments({ role: "teacher", approval: a })));
  res.json({
    teachers: teachers.map((t) => ({ ...t, id: t._id, state: stateOf(t), activeStudents: n[String(t._id)] || 0 })),
    counts: { pending: tally[0], approved: tally[1], rejected: tally[2], suspended: tally[3] },
  });
};

exports.get = async (req, res) => {
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  res.json({ teacher: { ...publicUser(t), id: t._id, state: stateOf(t) } });
};

// What each action needs. "unreviewed" = a teacher account created before approvals existed.
const ACTIONS = {
  approve:   { from: ["pending", "rejected", "unreviewed"], to: "approved",  needNote: false, notify: notifyTeacherApproved },
  reject:    { from: ["pending", "unreviewed"],             to: "rejected",  needNote: true,  notify: notifyTeacherRejected },
  suspend:   { from: ["approved"],                          to: "suspended", needNote: true,  notify: notifyTeacherSuspended },
  reinstate: { from: ["suspended"],                         to: "approved",  needNote: false, notify: notifyTeacherApproved },
};
exports.ACTIONS = ACTIONS;

// POST /api/admin/teachers/:id/decision  { action, note }
// Takes effect at once: teacher routes re-read the approval from the database on every request.
exports.decide = async (req, res) => {
  const spec = ACTIONS[req.body.action];
  if (!spec) return bad(res, "Unknown action.");
  const note = (req.body.note || "").trim();
  if (spec.needNote && !note) return bad(res, "Please give a short reason. It is recorded, and the teacher is told.");
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  const from = stateOf(t);
  if (!spec.from.includes(from)) return bad(res, `A ${from} teacher cannot be ${req.body.action}d.`, 409);
  if (spec.to === "approved" && !t.isVerified) return bad(res, "This teacher has not verified their email yet, so they cannot be approved.", 409);

  t.approval = spec.to;
  t.approvalReview = { by: req.user.id, at: new Date(), note: note || undefined };
  await t.save();
  await audit(req, { entityType: "teacher", entityId: t._id, event: `teacher.${req.body.action}`, meta: { from, to: spec.to, note: note || undefined } });
  await spec.notify(t, note);
  res.json({ teacher: { id: t._id, state: spec.to } });
};

// ---- Student assignment ----
exports.listAssignments = async (req, res) => {
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  const links = await TeacherAssignment.find({ teacherId: t._id, status: "active" });
  const ids = links.map((l) => l.studentId);
  const students = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName studentId") : [];
  const by = new Map(students.map((s) => [String(s._id), s]));
  res.json({
    students: links.filter((l) => by.has(String(l.studentId))).map((l) => {
      const s = by.get(String(l.studentId));
      return { id: s._id, firstName: s.firstName, lastName: s.lastName, studentId: s.studentId, subjects: l.subjects || [], assignedAt: l.assignedAt };
    }),
  });
};

exports.assignStudent = async (req, res) => {
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  if (t.approval !== "approved") return bad(res, "Approve the teacher before assigning students.", 409);
  const { studentId, subjects } = req.body;
  const s = await User.findById(studentId);
  if (!s || s.role !== "student") return bad(res, "Student not found", 404);

  let link = await TeacherAssignment.findOne({ teacherId: t._id, studentId: s._id });
  if (link && link.status === "active") return bad(res, "This student is already assigned to this teacher.", 409);
  try {
    if (link) {
      Object.assign(link, { status: "active", subjects: subjects && subjects.length ? subjects : undefined, assignedBy: req.user.id, assignedAt: new Date(), endedAt: undefined, endedBy: undefined });
      await link.save();
    } else {
      link = await TeacherAssignment.create({ teacherId: t._id, studentId: s._id, status: "active", subjects: subjects && subjects.length ? subjects : undefined, assignedBy: req.user.id });
    }
  } catch (err) {
    if (err && err.code === 11000) return bad(res, "This student is already assigned to this teacher.", 409); // two clicks at once
    throw err;
  }
  await audit(req, { entityType: "teacher", entityId: t._id, event: "teacher.assign", meta: { studentId: String(s._id) } });
  res.status(201).json({ assignment: { id: link._id, studentId: s._id, status: "active" } });
};

exports.unassignStudent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.studentId)) return bad(res, "Assignment not found", 404);
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  const link = await TeacherAssignment.findOne({ teacherId: t._id, studentId: req.params.studentId, status: "active" });
  if (!link) return bad(res, "Assignment not found", 404);
  link.status = "ended";
  link.endedAt = new Date();
  link.endedBy = req.user.id;
  await link.save();
  await audit(req, { entityType: "teacher", entityId: t._id, event: "teacher.unassign", meta: { studentId: String(req.params.studentId) } });
  res.json({ ok: true });
};

// ---- Library submissions from teachers ----
// GET /api/admin/teachers/library/review : drafts teachers have asked to publish, oldest first.
exports.libraryReview = async (req, res) => {
  const items = await Material.find({ status: "draft", "review.requestedAt": { $exists: true } })
    .select("-body -images").populate("subject", "name slug").populate("createdBy", "firstName lastName").sort({ "review.requestedAt": 1 }).limit(200).lean();
  res.json({ materials: items.map((m) => ({ id: m._id, title: m.title, kind: m.kind, source: m.source, subject: m.subject, teacher: m.createdBy, requestedAt: m.review.requestedAt })) });
};

const ready = (m) => (m.source === "link" && !!m.url) || (m.source === "pdf" && !!m.file) || (m.source === "text" && !!(m.body && m.body.trim())) || (m.source === "image" && (m.images || []).length > 0);

// POST /api/admin/teachers/library/:id/decision  { action: "publish" | "return", note }
exports.libraryDecision = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m || m.status !== "draft" || !(m.review && m.review.requestedAt)) return bad(res, "That material is not waiting for review.", 404);
  const note = (req.body.note || "").trim();
  if (req.body.action === "return" && !note) return bad(res, "Please tell the teacher what to change.");
  if (req.body.action === "publish" && !ready(m)) return bad(res, "This material is not ready to publish.", 422);
  const teacher = await User.findById(m.createdBy);

  if (req.body.action === "publish") { m.status = "published"; m.review = {}; }
  else m.review = { returnedAt: new Date(), note };
  m.updatedBy = req.user.id;
  await m.save();
  await audit(req, { entityType: "libraryMaterial", entityId: m._id, event: `teacher.material.${req.body.action}`, meta: { teacherId: String(m.createdBy), note: note || undefined } });
  if (teacher) await notifyTeacherMaterial(teacher, m.title, req.body.action === "publish" ? "published" : "returned", note);
  res.json({ material: { id: m._id, status: m.status } });
};

// ---- Subject groups: "this teacher looks after every approved student registered for <subject>" ----
exports.subjectOptions = async (req, res) => {
  const all = await Enrolment.distinct("subjectsRegistered", { status: "approved" });
  const seen = new Map();
  for (const x of all) { const k = String(x || "").trim(); if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k); }
  res.json({ subjects: [...seen.values()].sort((a, b) => a.localeCompare(b)) });
};

// How many approved enrolments a rule would cover, so an administrator sees the effect BEFORE creating it.
exports.groupPreview = async (req, res) => {
  const subject = String(req.query.subject || "").trim();
  if (subject.length < 2) return bad(res, "Choose a subject.");
  const programmeId = mongoose.isValidObjectId(req.query.programmeId) ? req.query.programmeId : undefined;
  res.json({ students: await Enrolment.countDocuments(groupFilter({ subject, programmeId })) });
};

exports.listGroups = async (req, res) => {
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  const groups = await TeacherGroup.find({ teacherId: t._id, status: "active" });
  const rows = [];
  for (const g of groups) rows.push({ id: g._id, subject: g.subject, programmeId: g.programmeId || null, students: await Enrolment.countDocuments(groupFilter(g)) });
  res.json({ groups: rows });
};

exports.addGroup = async (req, res) => {
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  if (t.approval !== "approved") return bad(res, "Approve the teacher before giving them a subject group.", 409);
  const subject = String(req.body.subject || "").trim();
  const programmeId = req.body.programmeId || undefined;
  const subjectKey = subject.toLowerCase();
  const programmeKey = programmeId ? String(programmeId) : "";
  let g = await TeacherGroup.findOne({ teacherId: t._id, subjectKey, programmeKey });
  if (g && g.status === "active") return bad(res, "This teacher already has that subject group.", 409);
  try {
    if (g) { Object.assign(g, { status: "active", subject, createdBy: req.user.id, endedAt: undefined, endedBy: undefined }); await g.save(); }
    else g = await TeacherGroup.create({ teacherId: t._id, subject, subjectKey, programmeId, programmeKey, status: "active", createdBy: req.user.id });
  } catch (err) {
    if (err && err.code === 11000) return bad(res, "This teacher already has that subject group.", 409);
    throw err;
  }
  await audit(req, { entityType: "teacher", entityId: t._id, event: "teacher.group.add", meta: { subject, programmeId: programmeId ? String(programmeId) : undefined } });
  res.status(201).json({ group: { id: g._id, subject, students: await Enrolment.countDocuments(groupFilter(g)) } });
};

exports.removeGroup = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.groupId)) return bad(res, "Group not found", 404);
  const t = await getTeacher(req.params.id);
  if (!t) return bad(res, "Teacher not found", 404);
  const g = await TeacherGroup.findOne({ _id: req.params.groupId, teacherId: t._id, status: "active" });
  if (!g) return bad(res, "Group not found", 404);
  g.status = "ended"; g.endedAt = new Date(); g.endedBy = req.user.id;
  await g.save();
  await audit(req, { entityType: "teacher", entityId: t._id, event: "teacher.group.remove", meta: { subject: g.subject } });
  res.json({ ok: true });
};

// ---- Courses and examinations teachers have asked to publish ----
exports.submissions = async (req, res) => {
  const status = ["pending", "returned", "published", "withdrawn"].includes(req.query.status) ? req.query.status : "pending";
  const items = await TeacherSubmission.find({ status }).populate("teacherId", "firstName lastName").sort({ requestedAt: 1 }).limit(200);
  res.json({ submissions: items.map((s) => ({ id: s._id, kind: s.kind, refId: s.refId, title: s.title, status: s.status, note: s.note, requestedAt: s.requestedAt, teacher: s.teacherId && s.teacherId.firstName ? { id: s.teacherId._id, name: `${s.teacherId.firstName} ${s.teacherId.lastName || ""}`.trim() } : null })) });
};

// Runs an existing admin controller (so publishing uses EXACTLY the same checks as the normal admin screens) and captures its answer.
async function runController(fn, req, params, body) {
  const out = { statusCode: 200, body: null };
  const res = { status(c) { out.statusCode = c; return this; }, json(b) { out.body = b; return this; }, set() { return this; }, send(b) { out.body = b; return this; } };
  await fn({ user: req.user, params, body, query: {}, headers: req.headers || {} }, res);
  return out;
}

exports.submissionDecision = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Submission not found", 404);
  const sub = await TeacherSubmission.findOne({ _id: req.params.id, status: "pending" });
  if (!sub) return bad(res, "That submission is not waiting for review.", 404);
  const note = (req.body.note || "").trim();
  if (req.body.action === "return" && !note) return bad(res, "Please tell the teacher what to change.");

  if (req.body.action === "publish") {
    const out = sub.kind === "course"
      ? await runController(adminLib.setCourseStatus, req, { id: String(sub.refId) }, { status: "published" })
      : await runController(adminExams.publish, req, { id: String(sub.refId) }, {});
    if (out.statusCode >= 400) return res.status(out.statusCode).json(out.body || { error: "Could not publish." }); // e.g. "This course is not ready to publish."
  }
  sub.status = req.body.action === "publish" ? "published" : "returned";
  sub.resolvedAt = new Date(); sub.resolvedBy = req.user.id; sub.note = note || undefined;
  await sub.save();
  await audit(req, { entityType: sub.kind, entityId: sub.refId, event: `teacher.${sub.kind}.${req.body.action}`, meta: { teacherId: String(sub.teacherId), note: note || undefined } });
  const teacher = await User.findById(sub.teacherId);
  if (teacher) await notifyTeacherSubmission(teacher, sub.title, sub.kind, req.body.action === "publish" ? "published" : "returned", note);
  res.json({ submission: { id: sub._id, status: sub.status } });
};

// Small numbers for the admin menu badge: what is waiting for an administrator.
exports.summary = async (req, res) => {
  const [pendingTeachers, pendingSubmissions, materialsWaiting] = await Promise.all([
    User.countDocuments({ role: "teacher", approval: "pending", isVerified: true }),
    TeacherSubmission.countDocuments({ status: "pending" }),
    Material.countDocuments({ status: "draft", "review.requestedAt": { $exists: true } }),
  ]);
  res.json({ pendingTeachers, pendingSubmissions, materialsWaiting, waiting: pendingTeachers + pendingSubmissions + materialsWaiting });
};
