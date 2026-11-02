const crypto = require("crypto");
const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Material = require("../models/LibraryMaterial");
const LibraryFile = require("../models/LibraryFile");
const Setting = require("../models/LibrarySetting");
const store = require("../utils/libraryStore");
const { canTransition, slugify } = require("../utils/library");
const { checkPdfBuffer, safeFileName } = require("../utils/libraryPdf");
const { checkImageBuffer, MAX_IMAGES } = require("../utils/libraryImage");
const syllabi = require("../data/utmeSyllabi");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const clean = (b) => ({ ...b, subject: b.subject || undefined });

// The subjects and exam groups from the registration form and the programme list. Adding them is one click and safe to repeat.
const SUBJECTS = ["English Language", "Mathematics", "Biology", "Chemistry", "Physics", "Agricultural Science", "Economics", "Government", "Literature", "Commerce", "CRS", "Geography", "Education", "Accounting", "Further Mathematics"];
const EXAM_GROUPS = ["JAMB", "WAEC", "NECO", "GCE", "Post-UTME"];

exports.seedSubjects = async (req, res) => {
  let added = 0;
  const all = [...SUBJECTS.map((name) => ({ name, group: "subject" })), ...EXAM_GROUPS.map((name) => ({ name, group: "exam-prep" }))];
  for (const [i, s] of all.entries()) {
    if (await Subject.findOne({ name: s.name }).collation({ locale: "en", strength: 2 })) continue;
    let slug = slugify(s.name), n = 2;
    while (await Subject.exists({ slug })) slug = `${slugify(s.name)}-${n++}`;
    await Subject.create({ ...s, slug, order: i });
    added++;
  }
  res.json({ added, total: all.length });
};

exports.listMaterials = async (req, res) => {
  const q = {};
  if (["draft", "published", "archived"].includes(req.query.status)) q.status = req.query.status;
  if (req.query.kind) q.kind = String(req.query.kind);
  const materials = await Material.find(q).populate("subject", "name slug").sort({ updatedAt: -1 }).limit(300).lean();
  res.json({ materials });
};

exports.createMaterial = async (req, res) => {
  const b = clean(req.body);
  if (b.subject && !(await Subject.exists({ _id: b.subject, status: "active" }))) return bad(res, "Choose an active subject.");
  if (b.source === "link" && !b.url) return bad(res, "Add the web link for this material.");
  const m = await Material.create({ ...b, url: b.source === "link" ? b.url : undefined, body: b.source === "text" ? b.body : undefined, status: "draft", createdBy: req.user.id, updatedBy: req.user.id });
  res.status(201).json({ material: m });
};

exports.updateMaterial = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  const b = clean(req.body);
  if (b.subject && !(await Subject.exists({ _id: b.subject, status: "active" }))) return bad(res, "Choose an active subject.");
  if (m.source !== "link") delete b.url;
  if (m.source !== "text") delete b.body;
  Object.assign(m, b, { updatedBy: req.user.id });
  if (req.body.subject === "" || req.body.subject === null) m.subject = undefined;
  if (m.source === "link" && !m.url) return bad(res, "A web-link material needs its link.");
  await m.save();
  res.json({ material: m });
};

exports.setMaterialStatus = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  const to = req.body.status;
  if (to === m.status) return res.json({ material: m });
  if (!["draft", "published", "archived"].includes(to) || !canTransition(m.status, to)) return bad(res, `A ${m.status} material cannot become ${to}.`, 409);
  const ready = (m.source === "link" && m.url) || (m.source === "pdf" && m.file) || (m.source === "text" && m.body && m.body.trim()) || (m.source === "image" && m.images.length > 0);
  if (to === "published" && !ready) {
    const need = { link: "Add the web link first.", pdf: "Upload the PDF first.", text: "Write or paste the text first.", image: "Upload at least one image first." }[m.source];
    return res.status(422).json({ error: "This material is not ready to publish.", errors: [need] });
  }
  m.status = to;
  m.updatedBy = req.user.id;
  await m.save();
  res.json({ material: m });
};

exports.uploadMaterialPdf = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  if (m.source !== "pdf") return bad(res, "This material is a web link, not a PDF.", 409);
  const problem = checkPdfBuffer(req.body);
  if (problem) return bad(res, problem, req.body && req.body.length > 0 ? 422 : 400);
  const name = safeFileName(req.headers["x-file-name"]);
  const gridId = await store.saveBuffer(req.body, name);
  const file = await LibraryFile.create({ gridId, size: req.body.length, sha256: crypto.createHash("sha256").update(req.body).digest("hex"), originalName: name, uploadedBy: req.user.id });
  const old = m.file;
  m.file = file._id;
  m.originalName = name;
  m.updatedBy = req.user.id;
  await m.save();
  if (old) await store.removeFile(old);
  res.json({ material: m });
};

// ---- exam countdown ----
exports.getCountdown = async (req, res) => {
  const s = await Setting.findOne({ key: "countdown" }).lean();
  const v = s && s.value;
  res.json({ countdown: v ? { label: v.label, date: v.targetDate ? new Date(v.targetDate).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) : "", official: !!v.official, enabled: !!v.enabled, note: v.note || "" } : null });
};

exports.saveCountdown = async (req, res) => {
  const { label, date, official, enabled, note } = req.body;
  const target = new Date(`${date}T00:00:00+01:00`); // midnight in Nigeria (WAT)
  if (Number.isNaN(target.getTime()) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return bad(res, "That is not a real date.");
  await Setting.findOneAndUpdate({ key: "countdown" }, { $set: { value: { label, targetDate: target, official, enabled, note: note || "" }, updatedBy: req.user.id } }, { upsert: true });
  res.json({ ok: true });
};

exports._isId = mongoose.isValidObjectId;

// ---- images (syllabus photos, scanned notes) ----
exports.addImage = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  if (m.source !== "image") return bad(res, "This material is not an image material.", 409);
  if (m.images.length >= MAX_IMAGES) return bad(res, `A material can have at most ${MAX_IMAGES} images.`, 409);
  const check = checkImageBuffer(req.body);
  if (check.error) return bad(res, check.error, req.body && req.body.length > 0 ? 422 : 400);
  const name = safeFileName(req.headers["x-file-name"]);
  const gridId = await store.saveBuffer(req.body, name, check.type);
  const file = await LibraryFile.create({ gridId, size: req.body.length, sha256: crypto.createHash("sha256").update(req.body).digest("hex"), originalName: name, contentType: check.type, uploadedBy: req.user.id });
  m.images.push({ file: file._id, name });
  m.updatedBy = req.user.id;
  await m.save();
  res.json({ material: m });
};

exports.removeImage = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  const img = m.images.find((i) => String(i.file) === String(req.params.fileId));
  if (!img) return bad(res, "Image not found", 404);
  m.images = m.images.filter((i) => String(i.file) !== String(req.params.fileId));
  m.updatedBy = req.user.id;
  await m.save();
  await store.removeFile(img.file);
  res.json({ material: m });
};

exports.reorderImages = async (req, res) => {
  const m = await Material.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  const have = new Set(m.images.map((i) => String(i.file)));
  if (req.body.ids.length !== have.size || !req.body.ids.every((i) => have.has(i))) return bad(res, "The list must contain every image exactly once.");
  const byId = Object.fromEntries(m.images.map((i) => [String(i.file), i]));
  m.images = req.body.ids.map((id) => byId[id]);
  await m.save();
  res.json({ material: m });
};

// One-click import of the UTME syllabus texts (Physics, English, Mathematics, Chemistry) as DRAFTS. Safe to repeat: existing titles are skipped.
exports.seedSyllabi = async (req, res) => {
  let added = 0;
  for (const s of syllabi) {
    if (await Material.exists({ title: s.title })) continue;
    const subject = await Subject.findOne({ name: s.subject }).collation({ locale: "en", strength: 2 }).select("_id");
    await Material.create({ title: s.title, kind: s.kind, source: "text", body: s.body, examTags: s.examTags, sourceNote: s.sourceNote, subject: subject ? subject._id : undefined, status: "draft", createdBy: req.user.id, updatedBy: req.user.id });
    added++;
  }
  res.json({ added, total: syllabi.length });
};
