const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Material = require("../models/LibraryMaterial");
const { servePdf } = require("../utils/libraryStore");
const adminMaterials = require("./adminLibraryMaterialsController");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KINDS = ["syllabus", "textbook", "past-questions", "notes", "other"];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return undefined; } };

// ---------- what teachers may READ ----------
// Teachers read the same PUBLISHED library as students (plus their own drafts), but in a read-only way:
// opening something here creates no reading progress, shelf or view records, so a teacher never appears in student learning data.
const card = (m) => ({
  id: m._id, title: m.title, kind: m.kind, description: m.description, author: m.author,
  subject: m.subject && m.subject.name ? { name: m.subject.name, slug: m.subject.slug } : undefined,
  examTags: m.examTags, source: m.source, host: m.source === "link" ? host(m.url) : undefined, featured: m.featured,
});
const isMine = (req, m) => String(m.createdBy) === String(req.user.id);

exports.subjects = async (req, res) => {
  const subjects = await Subject.find({ status: "active" }).sort({ group: 1, name: 1 }).select("name slug group").lean();
  res.json({ subjects });
};

exports.browse = async (req, res) => {
  const q = { status: "published" };
  if (req.query.kind && KINDS.includes(req.query.kind)) q.kind = req.query.kind;
  if (req.query.subject) { const s = await Subject.findOne({ slug: String(req.query.subject) }).select("_id"); q.subject = s ? s._id : null; }
  const term = String(req.query.q || "").trim().slice(0, 60);
  if (term.length >= 2) { const re = new RegExp(esc(term), "i"); q.$or = [{ title: re }, { description: re }, { author: re }, { body: re }]; }
  const items = await Material.find(q).select("-body -images").populate("subject", "name slug").sort({ featured: -1, updatedAt: -1 }).limit(100).lean();
  res.json({ materials: items.map(card) });
};

// Published material, or the teacher's OWN material of any status. Never another teacher's draft.
async function readable(req, res) {
  const m = await Material.findById(req.params.id).populate("subject", "name slug").lean();
  if (!m || (m.status !== "published" && !isMine(req, m))) { bad(res, "Material not found", 404); return null; }
  return m;
}

exports.getOne = async (req, res) => {
  const m = await readable(req, res);
  if (!m) return;
  res.json({
    material: {
      ...card(m), status: m.status, mine: isMine(req, m), sourceNote: m.sourceNote || undefined,
      url: m.source === "link" ? m.url : undefined,
      body: m.source === "text" ? m.body : undefined,
      images: m.source === "image" ? (m.images || []).map((i) => ({ id: i.file, name: i.name })) : undefined,
      pdfAvailable: m.source === "pdf" ? !!m.file : undefined,
      review: isMine(req, m) ? m.review : undefined,
    },
  });
};

exports.stream = async (req, res) => {
  const m = await readable(req, res);
  if (!m) return;
  if (m.source !== "pdf" || !m.file) return bad(res, "No document is attached to this material.", 404);
  return servePdf(req, res, m.file);
};

exports.streamImage = async (req, res) => {
  const m = await readable(req, res);
  if (!m) return;
  const ok = m.source === "image" && (m.images || []).some((i) => String(i.file) === String(req.params.fileId));
  if (!ok) return bad(res, "Image not found.", 404);
  return servePdf(req, res, req.params.fileId);
};

// ---------- what teachers may CREATE ----------
exports.mine = async (req, res) => {
  const items = await Material.find({ createdBy: req.user.id }).select("-body").populate("subject", "name slug").sort({ updatedAt: -1 }).limit(200).lean();
  res.json({
    materials: items.map((m) => ({
      ...card(m), status: m.status, review: m.review, updatedAt: m.updatedAt,
      underReview: m.status === "draft" && !!(m.review && m.review.requestedAt),
      imageCount: m.source === "image" ? (m.images || []).length : undefined,
      hasFile: m.source === "pdf" ? !!m.file : undefined,
    })),
  });
};

// router.param("id"): the teacher's OWN material, still a draft, and not waiting for review.
// Published and archived material, other teachers' material, and the administrators' material cannot be edited from here.
// The admin library controller then does the actual work, so uploads, checks and limits behave exactly as they do for administrators.
const owned = ({ allowLocked = false } = {}) => async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Material not found", 404);
    const m = await Material.findById(req.params.id).select("createdBy status review source");
    if (!m || String(m.createdBy) !== String(req.user.id)) return bad(res, "Material not found", 404);
    if (m.status !== "draft") return bad(res, "Only draft materials can be changed here. Ask an administrator to change published material.", 409);
    if (!allowLocked && m.review && m.review.requestedAt) return bad(res, "This material is waiting for review. Withdraw it first if you want to change it.", 409);
    req.material = m;
    next();
  } catch (err) { next(err); }
};
exports.owned = owned;

exports.create = (req, res) => { delete req.body.featured; return adminMaterials.createMaterial(req, res); };
exports.update = (req, res) => { delete req.body.featured; delete req.body.status; return adminMaterials.updateMaterial(req, res); };
exports.uploadPdf = (req, res) => adminMaterials.uploadMaterialPdf(req, res);
exports.addImage = (req, res) => adminMaterials.addImage(req, res);
exports.removeImage = (req, res) => adminMaterials.removeImage(req, res);
exports.reorderImages = (req, res) => adminMaterials.reorderImages(req, res);

// "Is there anything to publish?" - the same rule administrators' publish button uses.
exports.isReady = (m) => (m.source === "link" && !!m.url) || (m.source === "pdf" && !!m.file) || (m.source === "text" && !!(m.body && m.body.trim())) || (m.source === "image" && (m.images || []).length > 0);
const NEED = { link: "Add the web link first.", pdf: "Upload the PDF first.", text: "Write or paste the text first.", image: "Upload at least one image first." };

exports.submit = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!exports.isReady(m)) return res.status(422).json({ error: "This material is not ready to submit.", errors: [NEED[m.source]] });
  m.review = { requestedAt: new Date() };
  m.updatedBy = req.user.id;
  await m.save();
  res.json({ material: m });
};

exports.withdraw = async (req, res) => {
  const m = await Material.findById(req.params.id);
  m.review = {};
  m.updatedBy = req.user.id;
  await m.save();
  res.json({ material: m });
};
