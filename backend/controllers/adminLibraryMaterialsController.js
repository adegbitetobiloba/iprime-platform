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
const { planBulk, listFilter } = require("../utils/libraryBulk");

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

// Filtered, paged list for the admin screen. Long text is never loaded here.
exports.listMaterials = async (req, res) => {
  const filter = listFilter(req.query);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const [materials, total, counts] = await Promise.all([
    Material.find(filter).select("-body").populate("subject", "name slug").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Material.countDocuments(filter),
    Material.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  res.json({ materials, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
};

// Every id matching the current filters (up to 1000), so "select all matching" works across pages.
exports.materialIds = async (req, res) => {
  const rows = await Material.find(listFilter(req.query)).select("_id").limit(1000).lean();
  res.json({ ids: rows.map((r) => String(r._id)) });
};

// Bulk actions. Each item is checked with the same rules as the single-item buttons; what cannot be done is reported, not forced.
exports.bulkMaterials = async (req, res) => {
  const { action, ids, subject, tag } = req.body;
  const found = await Material.find({ _id: { $in: ids } }).select("title status source url file images importedFrom").lean();
  const withBody = new Set((await Material.find({ _id: { $in: ids }, source: "text", body: { $exists: true, $ne: "" } }).select("_id").lean()).map((m) => String(m._id)));
  const mats = found.map((m) => ({ ...m, hasBody: withBody.has(String(m._id)) }));
  const { ok, skipped } = planBulk(action, mats);
  const by = req.user.id;
  let changed = 0;
  if (ok.length) {
    const target = { _id: { $in: ok } };
    if (action === "publish") changed = (await Material.updateMany(target, { $set: { status: "published", updatedBy: by } })).modifiedCount;
    else if (action === "unpublish" || action === "restore") changed = (await Material.updateMany(target, { $set: { status: "draft", updatedBy: by } })).modifiedCount;
    else if (action === "archive") changed = (await Material.updateMany(target, { $set: { status: "archived", updatedBy: by } })).modifiedCount;
    else if (action === "set-subject") {
      if (subject && !(await Subject.exists({ _id: subject, status: "active" }))) return bad(res, "Choose an active subject.");
      changed = (await Material.updateMany(target, subject ? { $set: { subject, updatedBy: by } } : { $unset: { subject: 1 }, $set: { updatedBy: by } })).modifiedCount;
    } else if (action === "add-tag") {
      if (!tag) return bad(res, "Type the tag to add.");
      changed = (await Material.updateMany(target, { $addToSet: { examTags: tag }, $set: { updatedBy: by } })).modifiedCount;
    } else if (action === "remove-tag") {
      if (!tag) return bad(res, "Type the tag to remove.");
      changed = (await Material.updateMany(target, { $pull: { examTags: tag }, $set: { updatedBy: by } })).modifiedCount;
    } else if (action === "clear-reports") changed = (await Material.updateMany(target, { $set: { brokenReports: 0 } })).modifiedCount;
    else if (action === "delete") {
      // Remove the stored files too, then the records.
      const docs = await Material.find(target).select("file images").lean();
      for (const d of docs) { if (d.file) await store.removeFile(d.file); for (const im of d.images || []) await store.removeFile(im.file); }
      changed = (await Material.deleteMany({ ...target, status: "draft" })).deletedCount;
    }
  }
  res.json({ action, changed, skipped: skipped.slice(0, 20), skippedCount: skipped.length });
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

// ---- import from the Prime Integral app (and its sister apps) ----
// Everything is created as a DRAFT with an admin-only marker. Nothing is visible to students until an admin publishes it.
// Safe to repeat: an item whose title already exists for this source is skipped.
const PI_GROUPS = ["communities", "books", "classes", "videos", "quizzes", "notes"];
exports.primeIntegralSummary = (req, res) => {
  const d = require("../data/primeIntegral.json");
  res.json({ groups: PI_GROUPS.map((g) => ({ id: g, count: d[g].length })) });
};

exports.importPrimeIntegral = async (req, res) => {
  const d = require("../data/primeIntegral.json");
  const groups = Array.isArray(req.body.groups) && req.body.groups.length ? req.body.groups.filter((g) => PI_GROUPS.includes(g)) : PI_GROUPS;
  const subjects = Object.fromEntries((await Subject.find().select("name").lean()).map((s) => [s.name.toLowerCase(), s._id]));
  const have = new Set((await Material.find({ importedFrom: "prime-integral" }).select("title").lean()).map((m) => m.title));
  const docs = [];
  const add = (x) => { if (!have.has(x.title)) { have.add(x.title); docs.push({ ...x, examTags: ["JAMB"], status: "draft", importedFrom: "prime-integral", createdBy: req.user.id, updatedBy: req.user.id }); } };
  const subj = (n) => (n && subjects[String(n).toLowerCase()]) || undefined;
  if (groups.includes("communities")) d.communities.forEach((c) => add({ title: c.title, kind: "community", source: "link", url: c.url }));
  if (groups.includes("books")) d.books.forEach((b) => add({ title: b.title, kind: "textbook", source: "link", url: b.url, description: b.description || undefined, subject: subj(b.subject) }));
  if (groups.includes("classes")) d.classes.forEach((c) => add({ title: `${c.subject} class: ${c.title}`, kind: "notes", source: "link", url: c.url, subject: subj(c.subject) }));
  if (groups.includes("videos")) d.videos.forEach((v) => add({ title: `${v.subject ? `${v.subject}: ` : ""}${v.title}`, kind: "video", source: "link", url: v.url, subject: subj(v.subject) }));
  if (groups.includes("quizzes")) d.quizzes.forEach((q) => add({ title: `Practice quiz: ${q.title}`, kind: "practice", source: "link", url: q.url }));
  if (groups.includes("notes")) d.notes.forEach((n) => add({ title: n.title, kind: n.kind, source: "text", body: n.body, subject: subj(n.subject) }));
  if (docs.length) await Material.insertMany(docs);
  res.json({ added: docs.length, groups });
};

exports.getMaterial = async (req, res) => {
  const m = await Material.findById(req.params.id).populate("subject", "name slug").lean();
  if (!m) return bad(res, "Not found", 404);
  res.json({ material: m });
};
