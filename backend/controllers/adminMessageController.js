const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageFile = require("../models/MessageFile");
const User = require("../models/User");
const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const { parsePaging, escapeRegExp } = require("../utils/paging");
const { audit } = require("../utils/audit");
const hub = require("../utils/messageHub");
const { notifyStudentNewMessage } = require("../utils/messageNotify");
const M = require("./messageController");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const PAGE = 50;
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(" ");
const adminView = (m) => ({ id: String(m._id), from: m.senderRole, senderName: m.senderName, body: m.body, attachments: (m.attachments || []).map(M._attView), context: m.context && m.context.kind ? m.context : undefined, at: m.createdAt });
const studentSees = (m) => ({ id: String(m._id), from: m.senderRole, body: m.body, attachments: (m.attachments || []).map(M._attView), context: m.context && m.context.kind ? m.context : undefined, at: m.createdAt });

// Only real student accounts can be messaged. Anyone else gets "not found".
async function findStudent(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return User.findOne({ _id: id, role: "student" }).select("firstName lastName studentId email isVerified").lean();
}

// GET /api/admin/messages/stream : every administrator's open page receives new student messages instantly
exports.stream = (req, res) => { hub.open(req, res, hub.ADMIN_KEY); };

// GET /api/admin/messages/summary : how many conversations have something unread (menu badge)
exports.summary = async (req, res) => {
  try { res.json({ unreadConversations: await Conversation.countDocuments({ adminUnread: { $gt: 0 } }) }); } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/admins : who a conversation can be assigned to
exports.admins = async (req, res) => {
  try {
    const rows = await User.find({ role: "admin" }).select("firstName lastName").limit(50).lean();
    res.json({ admins: rows.map((a) => ({ id: String(a._id), name: fullName(a), isMe: String(a._id) === String(req.user.id) })) });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/conversations?unread=1&assigned=me|unassigned&page=
exports.conversations = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = {};
    if (req.query.unread === "1") filter.adminUnread = { $gt: 0 };
    if (req.query.assigned === "me") filter.assignedTo = req.user.id;
    if (req.query.assigned === "unassigned") filter.assignedTo = null;
    const [total, rows] = await Promise.all([Conversation.countDocuments(filter), Conversation.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean()]);
    const people = await User.find({ _id: { $in: rows.map((r) => r.studentId) } }).select("firstName lastName studentId").lean();
    const by = new Map(people.map((p) => [String(p._id), p]));
    res.json({
      conversations: rows.map((r) => { const p = by.get(String(r.studentId)); return { id: String(r._id), studentId: String(r.studentId), student: p ? { name: fullName(p), studentId: p.studentId } : null, lastMessageAt: r.lastMessageAt, preview: r.lastMessagePreview, lastSenderRole: r.lastSenderRole, unread: r.adminUnread || 0, assignedName: r.assignedName, assignedToMe: !!r.assignedTo && String(r.assignedTo) === String(req.user.id), blocked: M._isBlocked(r) }; }),
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

// GET /api/admin/messages/search?q= : search the words inside messages (3+ letters). Newest first, 20 at most.
exports.searchMessages = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 3) return res.json({ results: [] });
    const rx = new RegExp(escapeRegExp(q), "i");
    const rows = await Message.find({ body: rx }).sort({ _id: -1 }).limit(20).lean();
    const convs = await Conversation.find({ _id: { $in: rows.map((r) => r.conversationId) } }).select("studentId").lean();
    const cById = new Map(convs.map((c) => [String(c._id), c]));
    const people = await User.find({ _id: { $in: convs.map((c) => c.studentId) } }).select("firstName lastName studentId").lean();
    const pById = new Map(people.map((p) => [String(p._id), p]));
    res.json({ results: rows.map((r) => {
      const c = cById.get(String(r.conversationId)); const p = c && pById.get(String(c.studentId));
      const i = r.body.toLowerCase().indexOf(q.toLowerCase());
      const from = Math.max(0, i - 40);
      return { id: String(r._id), studentId: c ? String(c.studentId) : null, studentName: p ? fullName(p) : "Unknown", from: r.senderRole, snippet: `${from > 0 ? "..." : ""}${r.body.slice(from, i + q.length + 60)}${r.body.length > i + q.length + 60 ? "..." : ""}`, at: r.createdAt };
    }) });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/students/:studentId?before=
exports.thread = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const conv = await Conversation.findOne({ studentId: student._id }).lean();
    const person = { id: String(student._id), name: fullName(student), studentId: student.studentId };
    const info = { assignedName: conv && conv.assignedName, assignedToMe: !!(conv && conv.assignedTo) && String(conv.assignedTo) === String(req.user.id), blocked: M._isBlocked(conv), blockedReason: conv && conv.blocked && conv.blocked.reason };
    if (!conv) return res.json({ student: person, unread: 0, messages: [], hasMore: false, ...info });
    const filter = { conversationId: conv._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const rows = await Message.find(filter).sort({ _id: -1 }).limit(PAGE + 1).lean();
    res.json({ student: person, unread: conv.adminUnread || 0, messages: rows.slice(0, PAGE).reverse().map(adminView), hasMore: rows.length > PAGE, ...info });
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

// POST /api/admin/messages/students/:studentId { body, fileIds?, attemptId? } : message a student, optionally as a comment on one real result
exports.send = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const text = String(req.body.body || "").trim();
    const fileIds = req.body.fileIds || [];
    if (!text && !fileIds.length) return res.status(400).json({ error: "Write a message first" });

    let context;
    if (req.body.attemptId) {
      const attempt = await Attempt.findOne({ _id: req.body.attemptId, userId: student._id, status: "submitted" }).lean();
      if (!attempt) return res.status(404).json({ error: "That result was not found for this student." });
      const exam = await Exam.findById(attempt.examId).select("title subject").lean();
      // Taken from the stored attempt, never from the request, so a comment can never show invented figures.
      context = { kind: "attempt", attemptId: attempt._id, examTitle: exam ? exam.title : "Examination", subject: exam ? exam.subject : undefined, score: attempt.score, totalMarks: attempt.totalMarks, percentage: attempt.percentage, submittedAt: attempt.submittedAt };
    }

    const conv = await M._ensureConversation(student._id);
    const { files, error } = await M._resolveAttachments(fileIds, req.user.id, conv._id);
    if (error) return res.status(400).json({ error });
    const me = await User.findById(req.user.id).select("firstName").lean();
    const msg = await Message.create({ conversationId: conv._id, senderId: req.user.id, senderRole: "admin", senderName: me ? me.firstName : undefined, body: text, attachments: M._attachmentDocs(files), ...(context ? { context } : {}) });
    if (files.length) await MessageFile.updateMany({ _id: { $in: files.map((f) => f._id) } }, { $set: { attached: true, messageId: msg._id } });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: msg.createdAt || new Date(), lastMessagePreview: M._previewOf(text, files), lastSenderRole: "admin" }, $inc: { studentUnread: 1 } });
    // The audit entry records that a message was sent, never its content.
    await audit(req, { entityType: "conversation", entityId: conv._id, event: "message.admin_sent", meta: { hasResultComment: !!context, attachments: files.length } });

    const m = msg.toObject ? msg.toObject() : msg;
    M._emit([hub.studentKey(student._id)], { type: "message", message: studentSees(m) });             // the student sees it at once
    M._emit([hub.ADMIN_KEY], { type: "message", studentId: String(student._id), message: adminView(m) }); // and so do the other administrators
    if (!conv.studentUnread) notifyStudentNewMessage(student).catch(() => {});                          // one email per burst, no message text
    res.status(201).json({ message: adminView(m) });
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

// POST /api/admin/messages/students/:studentId/block { reason } and /unblock
exports.block = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const conv = await M._ensureConversation(student._id);
    await Conversation.updateOne({ _id: conv._id }, { $set: { blocked: { at: new Date(), by: req.user.id, reason: req.body.reason } } });
    await audit(req, { entityType: "conversation", entityId: conv._id, event: "message.blocked", meta: {} });
    M._emit([hub.studentKey(student._id)], { type: "state", blocked: true });
    M._emit([hub.ADMIN_KEY], { type: "conversation", studentId: String(student._id) });
    res.json({ blocked: true });
  } catch (err) { serverError(res, err); }
};
exports.unblock = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    await Conversation.updateOne({ studentId: student._id }, { $unset: { blocked: 1 } });
    await audit(req, { entityType: "conversation", entityId: student._id, event: "message.unblocked", meta: {} });
    M._emit([hub.studentKey(student._id)], { type: "state", blocked: false });
    M._emit([hub.ADMIN_KEY], { type: "conversation", studentId: String(student._id) });
    res.json({ blocked: false });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/messages/students/:studentId/assign { adminId: "me" | <id> | null }
exports.assign = async (req, res) => {
  try {
    const student = await findStudent(req.params.studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const want = req.body.adminId === "me" ? String(req.user.id) : req.body.adminId || null;
    const conv = await M._ensureConversation(student._id);
    if (!want) {
      await Conversation.updateOne({ _id: conv._id }, { $unset: { assignedTo: 1, assignedName: 1 } });
    } else {
      const admin = mongoose.isValidObjectId(want) ? await User.findOne({ _id: want, role: "admin" }).select("firstName lastName").lean() : null;
      if (!admin) return res.status(400).json({ error: "That person is not an administrator." });
      await Conversation.updateOne({ _id: conv._id }, { $set: { assignedTo: admin._id, assignedName: admin.firstName } });
    }
    await audit(req, { entityType: "conversation", entityId: conv._id, event: want ? "message.assigned" : "message.unassigned", meta: { toSelf: want === String(req.user.id) } });
    M._emit([hub.ADMIN_KEY], { type: "conversation", studentId: String(student._id) });
    res.json({ assigned: !!want });
  } catch (err) { serverError(res, err); }
};
