const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const { parsePaging, escapeRegExp } = require("../utils/paging");
const { audit } = require("../utils/audit");
const { _preview: preview, _ensureConversation: ensureConversation } = require("./messageController");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const PAGE = 50;
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(" ");
const adminView = (m) => ({ id: String(m._id), from: m.senderRole, senderName: m.senderName, body: m.body, context: m.context && m.context.kind ? m.context : undefined, at: m.createdAt });

// Only real student accounts can be messaged. Anyone else gets "not found".
async function findStudent(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findOne({ _id: id, role: "student" }).select("firstName lastName studentId").lean();
}

// GET /api/admin/messages/summary : how many conversations have something unread (menu badge)
exports.summary = async (req, res) => {
  try { res.json({ unreadConversations: await Conversation.countDocuments({ adminUnread: { $gt: 0 } }) }); } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/conversations?unread=1&page=
exports.conversations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = req.query.unread === "1" ? { adminUnread: { $gt: 0 } } : {};
    const [total, rows] = await Promise.all([Conversation.countDocuments(filter), Conversation.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean()]);
    const people = await User.find({ _id: { $in: rows.map((r) => r.studentId) } }).select("firstName lastName studentId").lean();
    const by = new Map(people.map((p) => [String(p._id), p]));
    res.json({
      conversations: rows.map((r) => { const p = by.get(String(r.studentId)); return { id: String(r._id), studentId: String(r.studentId), student: p ? { name: fullName(p), studentId: p.studentId } : null, lastMessageAt: r.lastMessageAt, preview: r.lastMessagePreview, lastSenderRole: r.lastSenderRole, unread: r.adminUnread || 0 }; }),
      page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/students?search= : find a student to start a conversation with
exports.searchStudents = async (req, res) => {
  try {
    const q = String(req.query.search || "").trim();
    if (q.length < 2) return res.json({ students: [] });
    const rx = new RegExp(escapeRegExp(q), "i");
    const rows = await User.find({ role: "student", $or: [{ firstName: rx }, { lastName: rx }, { studentId: rx }] }).select("firstName lastName studentId").limit(10).lean();
    res.json({ students: rows.map((u) => ({ id: String(u._id), name: fullName(u), studentId: u.studentId })) });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/students/:studentId?before=
exports.thread = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const conv = await Conversation.findOne({ studentId: student._id }).lean();
    const person = { id: String(student._id), name: fullName(student), studentId: student.studentId };
    if (!conv) return res.json({ student: person, unread: 0, messages: [], hasMore: false });
    const filter = { conversationId: conv._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const rows = await Message.find(filter).sort({ _id: -1 }).limit(PAGE + 1).lean();
    res.json({ student: person, unread: conv.adminUnread || 0, messages: rows.slice(0, PAGE).reverse().map(adminView), hasMore: rows.length > PAGE });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/students/:studentId/attempts : recent submitted attempts the administrator can comment on
exports.attempts = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const rows = await Attempt.find({ userId: student._id, status: "submitted" }).sort({ submittedAt: -1 }).limit(15).select("examId score totalMarks percentage submittedAt").lean();
    const exams = await Exam.find({ _id: { $in: rows.map((r) => r.examId) } }).select("title subject").lean();
    const by = new Map(exams.map((e) => [String(e._id), e]));
    res.json({ attempts: rows.map((r) => ({ id: String(r._id), examTitle: (by.get(String(r.examId)) || {}).title || "Examination", subject: (by.get(String(r.examId)) || {}).subject, score: r.score, totalMarks: r.totalMarks, percentage: r.percentage, submittedAt: r.submittedAt })) });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/messages/students/:studentId { body, attemptId? } : message a student, optionally as a comment on one real result
exports.send = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const text = req.body.body;

    let context;
    if (req.body.attemptId) {
      const attempt = await Attempt.findOne({ _id: req.body.attemptId, userId: student._id, status: "submitted" }).lean();
      if (!attempt) return res.status(404).json({ error: "That result was not found for this student." });
      const exam = await Exam.findById(attempt.examId).select("title subject").lean();
      // Taken from the stored attempt, never from the request, so a comment can never show invented figures.
      context = { kind: "attempt", attemptId: attempt._id, examTitle: exam ? exam.title : "Examination", subject: exam ? exam.subject : undefined, score: attempt.score, totalMarks: attempt.totalMarks, percentage: attempt.percentage, submittedAt: attempt.submittedAt };
    }

    const me = await User.findById(req.user.id).select("firstName").lean();
    const conv = await ensureConversation(student._id);
    const msg = await Message.create({ conversationId: conv._id, senderId: req.user.id, senderRole: "admin", senderName: me ? me.firstName : undefined, body: text, ...(context ? { context } : {}) });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: msg.createdAt || new Date(), lastMessagePreview: preview(text), lastSenderRole: "admin" }, $inc: { studentUnread: 1 } });
    // The audit entry records that a message was sent, never its content.
    await audit(req, { entityType: "conversation", entityId: conv._id, event: "message.admin_sent", meta: { hasResultComment: !!context } });
    res.status(201).json({ message: adminView(msg.toObject ? msg.toObject() : msg) });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/messages/students/:studentId/read
exports.markRead = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    await Conversation.updateOne({ studentId: student._id }, { $set: { adminUnread: 0 } });
    res.json({ unread: 0 });
  } catch (err) { serverError(res, err); }
};
