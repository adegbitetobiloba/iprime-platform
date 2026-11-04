const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const MessageFile = require("../models/MessageFile");
const { checkUpload, sniff, safeName, sha256 } = require("../utils/messageFiles");
const { _ensureConversation: ensureConversation, _isBlocked: isBlocked, _BLOCKED: BLOCKED } = require("./messageController");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };

// Stores one uploaded file (raw bytes in the request body). It stays private and unattached until a message uses it.
async function store(req, res, conv) {
  const buf = req.body;
  const problem = checkUpload(buf, req.headers["content-type"]);
  if (problem) return res.status(400).json({ error: problem });
  const type = sniff(buf); // trust the bytes, not the name
  const doc = await MessageFile.create({ data: buf, size: buf.length, sha256: sha256(buf), name: safeName(req.headers["x-file-name"], type), contentType: type, uploadedBy: req.user.id, conversationId: conv._id });
  res.status(201).json({ file: { id: String(doc._id), name: doc.name, size: doc.size, contentType: doc.contentType } });
}

// Sent as a download, never rendered by the server's own origin, and with sniffing switched off.
function serve(res, f) {
  res.set({ "Content-Type": f.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name || "attachment")}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Length": String(f.data.length) });
  res.status(200).send(f.data);
}

// POST /api/messages/files (student)
exports.uploadStudent = async (req, res) => {
  try {
    const conv = await ensureConversation(req.user.id);
    if (isBlocked(conv)) return res.status(403).json(BLOCKED);
    await store(req, res, conv);
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/messages/students/:studentId/files (admin)
exports.uploadAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.studentId)) return res.status(404).json({ error: "Student not found" });
    const student = await User.findOne({ _id: req.params.studentId, role: "student" }).select("_id").lean();
    if (!student) return res.status(404).json({ error: "Student not found" });
    await store(req, res, await ensureConversation(student._id));
  } catch (err) { serverError(res, err); }
};

// GET /api/messages/files/:id (student: only files in their own conversation, and only once sent)
exports.downloadStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "File not found" });
    const conv = await Conversation.findOne({ studentId: req.user.id }).select("_id").lean();
    const f = conv && (await MessageFile.findOne({ _id: req.params.id, conversationId: conv._id, attached: true }).select("+data name contentType").lean());
    if (!f) return res.status(404).json({ error: "File not found" });
    serve(res, f);
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/messages/files/:id (admin)
exports.downloadAdmin = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "File not found" });
    const f = await MessageFile.findOne({ _id: req.params.id, attached: true }).select("+data name contentType").lean();
    if (!f) return res.status(404).json({ error: "File not found" });
    serve(res, f);
  } catch (err) { serverError(res, err); }
};
