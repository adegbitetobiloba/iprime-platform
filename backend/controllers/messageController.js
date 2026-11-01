const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const PAGE = 50;
const preview = (s) => (s.length > 150 ? `${s.slice(0, 150)}...` : s).replace(/\s+/g, " ");

// Finds or creates the thread. If two first messages arrive at the same instant, the database's one-thread-per-student rule
// rejects the second create; we then simply read the thread the first one made.
async function ensureConversation(studentId) {
  const make = () => Conversation.findOneAndUpdate({ studentId }, { $setOnInsert: { studentId, studentUnread: 0, adminUnread: 0 } }, { upsert: true, new: true }).lean();
  try { return await make(); } catch (err) {
    if (err && err.code === 11000) return Conversation.findOne({ studentId }).lean();
    throw err;
  }
}

// What a student may see of a message. Administrators appear only as "the team": no names or ids.
const studentView = (m) => ({ id: String(m._id), from: m.senderRole, body: m.body, context: m.context && m.context.kind ? m.context : undefined, at: m.createdAt });

// GET /api/messages/thread?before=<messageId> : the student's own thread (there is no way to ask for anyone else's)
exports.thread = async (req, res) => {
  try {
    const conv = await Conversation.findOne({ studentId: req.user.id }).lean();
    if (!conv) return res.json({ unread: 0, messages: [], hasMore: false });
    const filter = { conversationId: conv._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
    const rows = await Message.find(filter).sort({ _id: -1 }).limit(PAGE + 1).lean();
    const hasMore = rows.length > PAGE;
    res.json({ unread: conv.studentUnread || 0, messages: rows.slice(0, PAGE).reverse().map(studentView), hasMore });
  } catch (err) { serverError(res, err); }
};

// GET /api/messages/unread : for the badge in the menu
exports.unread = async (req, res) => {
  try {
    const conv = await Conversation.findOne({ studentId: req.user.id }).select("studentUnread").lean();
    res.json({ unread: (conv && conv.studentUnread) || 0 });
  } catch (err) { serverError(res, err); }
};

// POST /api/messages { body } : a student writes to the administration team. The recipient cannot be chosen.
exports.send = async (req, res) => {
  try {
    const text = req.body.body;
    // 1) make sure the thread exists, 2) store the message, 3) update the counters. If step 3 fails the message is still safe.
    const conv = await ensureConversation(req.user.id);
    const msg = await Message.create({ conversationId: conv._id, senderId: req.user.id, senderRole: "student", body: text });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessageAt: msg.createdAt || new Date(), lastMessagePreview: preview(text), lastSenderRole: "student" }, $inc: { adminUnread: 1 } });
    res.status(201).json({ message: studentView(msg.toObject ? msg.toObject() : msg) });
  } catch (err) { serverError(res, err); }
};

// POST /api/messages/read : the student opened the thread
exports.markRead = async (req, res) => {
  try {
    await Conversation.updateOne({ studentId: req.user.id }, { $set: { studentUnread: 0 } });
    res.json({ unread: 0 });
  } catch (err) { serverError(res, err); }
};

exports._preview = preview;
exports._ensureConversation = ensureConversation;
