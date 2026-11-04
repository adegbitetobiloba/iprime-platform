const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageFile = require("../models/MessageFile");
const User = require("../models/User");
const hub = require("../utils/messageHub");
const { notifyAdminsNewMessage } = require("../utils/messageNotify");
const { MAX_PER_MESSAGE } = require("../utils/messageFiles");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const PAGE = 50;
const BLOCKED = { error: "Messaging is turned off for your account. Please contact the office.", code: "MESSAGING_BLOCKED" };
const preview = (s) => (s.length > 150 ? `${s.slice(0, 150)}...` : s).replace(/\s+/g, " ");
const isBlocked = (conv) => !!(conv && conv.blocked && conv.blocked.at);

// Finds or creates the thread. If two first messages arrive at the same instant, the database's one-thread-per-student rule
// rejects the second create; we then simply read the thread the first one made.
async function ensureConversation(studentId) {
  const make = () => Conversation.findOneAndUpdate({ studentId }, { $setOnInsert: { studentId, studentUnread: 0, adminUnread: 0 } }, { upsert: true, new: true }).lean();
  try { return await make(); } catch (err) {
    if (err && err.code === 11000) return Conversation.findOne({ studentId }).lean();
    throw err;
  }
}

const attView = (a) => ({ id: String(a.fileId), name: a.name, size: a.size, contentType: a.contentType });
// What a student may see of a message. Administrators appear only as "the team": no names or ids.
const studentView = (m) => ({ id: String(m._id), from: m.senderRole, body: m.body, attachments: (m.attachments || []).map(attView), context: m.context && m.context.kind ? m.context : undefined, at: m.createdAt });

// Checks the files a sender wants to attach: theirs, in this conversation, not used before, at most 3.
async function resolveAttachments(fileIds, uploaderId, convId) {
  const ids = [...new Set((fileIds || []).map(String))];
  if (!ids.length) return { files: [] };
  if (ids.length > MAX_PER_MESSAGE || !ids.every((i) => mongoose.isValidObjectId(i))) return { error: "You can attach up to 3 files to one message." };
  const files = await MessageFile.find({ _id: { $in: ids }, uploadedBy: uploaderId, conversationId: convId, attached: false }).select("name size contentType").lean();
  if (files.length !== ids.length) return { error: "One of the attached files could not be used. Please attach it again." };
  return { files };
}
const attachmentDocs = (files) => files.map((f) => ({ fileId: f._id, name: f.name, size: f.size, contentType: f.contentType }));
const previewOf = (text, files) => preview(text || (files[0] ? `Attachment: ${files[0].name}` : ""));
// A live push must never make a send fail.
const emit = (keys, event) => { try { hub.publish(keys, event); } catch (err) { console.error("live push failed:", err.message); } };

// GET /api/messages/thread?before=<messageId> : the student's own thread (there is no way to ask for anyone else's)
exports.thread = async (req, res) => {
  try {
    const conv = await Conversation.findOne({ studentId: req.user.id }).lean();
    if (!conv) return res.json({ unread: 0, messages: [], hasMore: false, blocked: false });
    const filter = { conversationId: conv._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const rows = await Message.find(filter).sort({ _id: -1 }).limit(PAGE + 1).lean();
    res.json({ unread: conv.studentUnread || 0, messages: rows.slice(0, PAGE).reverse().map(studentView), hasMore: rows.length > PAGE, blocked: isBlocked(conv) });
  } catch (err) { serverError(res, err); }
};

// GET /api/messages/unread : for the badge in the menu
exports.unread = async (req, res) => {
  try {
    const conv = await Conversation.findOne({ studentId: req.user.id }).select("studentUnread").lean();
    res.json({ unread: (conv && conv.studentUnread) || 0 });
  } catch (err) { serverError(res, err); }
};

// GET /api/messages/stream : new messages arrive here the moment they are sent (Server-Sent Events)
exports.stream = (req, res) => { hub.open(req, res, hub.studentKey(req.user.id)); };

// POST /api/messages { body, fileIds? } : a student writes to the administration team. The recipient cannot be chosen.
exports.send = async (req, res) => {
  try {
    const text = String(req.body.body || "").trim();
    const fileIds = req.body.fileIds || [];
    if (!text && !fileIds.length) return res.status(400).json({ error: "Write a message first" });
    const conv = await ensureConversation(req.user.id);
    if (isBlocked(conv)) return res.status(403).json(BLOCKED);
    const { files, error } = await resolveAttachments(fileIds, req.user.id, conv._id);
    if (error) return res.status(400).json({ error });

    // Store the message first, then the counters: if the counters fail the message is still safe.
    const msg = await Message.create({ conversationId: conv._id, senderId: req.user.id, senderRole: "student", body: text, attachments: attachmentDocs(files) });
    if (files.length) await MessageFile.updateMany({ _id: { $in: files.map((f) => f._id) } }, { $set: { attached: true, messageId: msg._id } });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: msg.createdAt || new Date(), lastMessagePreview: previewOf(text, files), lastSenderRole: "student" }, $inc: { adminUnread: 1 } });

    const m = msg.toObject ? msg.toObject() : msg;
    emit([hub.ADMIN_KEY], { type: "message", studentId: String(req.user.id), message: { id: String(m._id), from: "student", body: m.body, attachments: (m.attachments || []).map(attView), at: m.createdAt } });
    emit([hub.studentKey(req.user.id)], { type: "message", message: studentView(m) }); // the student's other open tabs
    if (!conv.adminUnread) { // first unread only: one burst of messages sends one email
      User.findById(req.user.id).select("firstName lastName").lean().then((u) => notifyAdminsNewMessage(u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "A student")).catch(() => {});
    }
    res.status(201).json({ message: studentView(m) });
  } catch (err) { serverError(res, err); }
};

// POST /api/messages/read : the student opened the thread
exports.markRead = async (req, res) => {
  try {
    await Conversation.updateOne({ studentId: req.user.id }, { $set: { studentUnread: 0 } });
    res.json({ unread: 0 });
  } catch (err) { serverError(res, err); }
};

Object.assign(exports, { _preview: preview, _ensureConversation: ensureConversation, _resolveAttachments: resolveAttachments, _attachmentDocs: attachmentDocs, _previewOf: previewOf, _attView: attView, _emit: emit, _isBlocked: isBlocked, _BLOCKED: BLOCKED });
