const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const Material = require("../models/LibraryMaterial");
const View = require("../models/LibraryMaterialView");
const Setting = require("../models/LibrarySetting");
const { servePdf } = require("../utils/libraryStore");
const { daysLeft, studyPlan } = require("../utils/libraryCountdown");
const { readingPercent, FINISHED_AT } = require("../utils/libraryProgress");
const main = require("./libraryController");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isAdmin = (req) => req.user.role === "admin";
const UTME_TAGS = [/^jamb$/i, /^utme$/i];
const KINDS = ["syllabus", "textbook", "past-questions", "notes", "other"];

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return undefined; } };
// What the browser receives. Never the body in lists, never a PDF's file id.
const card = (m, v) => ({
  id: m._id, title: m.title, kind: m.kind, description: m.description, author: m.author,
  subject: m.subject && m.subject.name ? { name: m.subject.name, slug: m.subject.slug } : undefined,
  examTags: m.examTags, source: m.source, host: m.source === "link" ? host(m.url) : undefined, featured: m.featured,
  shelf: v && v.shelf ? v.shelf : undefined, percent: v && v.percent ? v.percent : undefined,
});

async function viewsFor(userId, ids) {
  const rows = await View.find({ user: userId, material: { $in: ids } }).select("material shelf percent").lean();
  return Object.fromEntries(rows.map((r) => [String(r.material), r]));
}

async function visible(req, res) {
  const m = await Material.findById(req.params.id).populate("subject", "name slug").lean();
  if (!m || (m.status !== "published" && !isAdmin(req))) { bad(res, "Material not found", 404); return null; }
  return m;
}

exports.list = async (req, res) => {
  const q = { status: "published" };
  if (req.query.kind && KINDS.includes(req.query.kind)) q.kind = req.query.kind;
  if (req.query.subject) { const s = await Subject.findOne({ slug: String(req.query.subject) }).select("_id"); q.subject = s ? s._id : null; }
  if (req.query.tag) q.examTags = new RegExp(`^${esc(String(req.query.tag).slice(0, 30))}$`, "i");
  const term = String(req.query.q || "").trim().slice(0, 60);
  // A search also looks inside written materials, so "Doppler" finds the Physics syllabus.
  if (term.length >= 2) { const re = new RegExp(esc(term), "i"); q.$or = [{ title: re }, { description: re }, { author: re }, { body: re }]; }
  const [items, facets] = await Promise.all([
    Material.find(q).select("-body -images").populate("subject", "name slug").sort({ featured: -1, updatedAt: -1 }).limit(100).lean(),
    Material.aggregate([{ $match: { status: "published" } }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
  ]);
  const subjects = await Subject.find({ _id: { $in: await Material.distinct("subject", { status: "published" }) } }).sort({ name: 1 }).select("name slug").lean();
  const views = isAdmin(req) ? {} : await viewsFor(req.user.id, items.map((i) => i._id));
  res.json({ materials: items.map((m) => card(m, views[String(m._id)])), kinds: Object.fromEntries(facets.map((f) => [f._id, f.n])), subjects: subjects.map((s) => ({ name: s.name, slug: s.slug })) });
};

exports.get = async (req, res) => {
  const m = await visible(req, res);
  if (!m) return;
  let view = null;
  if (!isAdmin(req)) {
    // Opening something new puts it on the "Reading" shelf. An existing shelf choice is never overwritten.
    view = await View.findOneAndUpdate({ user: req.user.id, material: m._id }, { $set: { lastOpenedAt: new Date() }, $inc: { openCount: 1 }, $setOnInsert: { shelf: "reading" } }, { upsert: true, new: true }).lean();
  }
  const relatedQuery = { status: "published", _id: { $ne: m._id }, ...(m.subject ? { subject: m.subject._id } : { kind: m.kind }) };
  const related = await Material.find(relatedQuery).select("-body -images").populate("subject", "name slug").sort({ updatedAt: -1 }).limit(4).lean();
  res.json({
    preview: m.status !== "published",
    material: {
      ...card(m, view),
      sourceNote: m.sourceNote || undefined,
      url: m.source === "link" ? m.url : undefined,
      body: m.source === "text" ? m.body : undefined,
      images: m.source === "image" ? (m.images || []).map((i) => ({ id: i.file, name: i.name })) : undefined,
      pdfAvailable: m.source === "pdf" ? !!m.file : undefined,
    },
    lastPage: view ? view.lastPage || 1 : 1,
    related: related.map((r) => card(r)),
  });
};

// Reading position from the reader: { page, pageCount } for PDFs, { percent } for text and images.
exports.progress = async (req, res) => {
  if (isAdmin(req)) return res.json({ ok: true, preview: true });
  const m = await Material.findOne({ _id: req.params.id, status: "published" }).select("_id");
  if (!m) return bad(res, "Material not found", 404);
  const pct = readingPercent(req.body);
  if (pct === null) return bad(res, "Nothing to save.");
  const set = {};
  if (req.body.page) set.lastPage = req.body.page;
  if (req.body.pageCount) set.pageCount = req.body.pageCount;
  const update = { $max: { percent: pct } };
  if (Object.keys(set).length) update.$set = set;
  const v = await View.findOneAndUpdate({ user: req.user.id, material: m._id }, update, { upsert: true, new: true });
  // Reaching the end for the first time moves it to Finished. Later shelf choices are respected.
  if (v.percent >= FINISHED_AT && !v.finishedAt) { v.finishedAt = new Date(); v.shelf = "done"; await v.save(); }
  res.json({ ok: true, percent: v.percent, shelf: v.shelf });
};

exports.setShelf = async (req, res) => {
  if (isAdmin(req)) return res.json({ ok: true, preview: true });
  const m = await Material.findOne({ _id: req.params.id, status: "published" }).select("_id");
  if (!m) return bad(res, "Material not found", 404);
  const s = req.body.shelf;
  await View.updateOne({ user: req.user.id, material: m._id }, s === "none" ? { $unset: { shelf: 1 } } : { $set: { shelf: s } }, { upsert: true });
  res.json({ ok: true, shelf: s === "none" ? null : s });
};

// The student's private shelf: Want to read / Reading / Finished. Only the student can see it.
exports.shelf = async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
  const filter = { user: req.user.id, shelf: ["want", "reading", "done"].includes(req.query.status) ? req.query.status : { $in: ["want", "reading", "done"] } };
  const [rows, counts] = await Promise.all([
    View.find(filter).sort({ lastOpenedAt: -1, updatedAt: -1 }).limit(limit).populate({ path: "material", select: "-body -images", populate: { path: "subject", select: "name slug" } }).lean(),
    View.aggregate([{ $match: { user: new mongoose.Types.ObjectId(req.user.id), shelf: { $exists: true } } }, { $group: { _id: "$shelf", n: { $sum: 1 } } }]),
  ]);
  res.json({
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
    materials: rows.filter((r) => r.material && r.material.status === "published").map((r) => card(r.material, r)),
  });
};

exports.stream = async (req, res) => {
  const m = await visible(req, res);
  if (!m) return;
  if (m.source !== "pdf" || !m.file) return bad(res, "No document is attached to this material.", 404);
  return servePdf(req, res, m.file);
};

exports.streamImage = async (req, res) => {
  const m = await visible(req, res);
  if (!m) return;
  const ok = m.source === "image" && (m.images || []).some((i) => String(i.file) === String(req.params.fileId));
  if (!ok) return bad(res, "Image not found.", 404);
  return servePdf(req, res, req.params.fileId);
};

// UTME hub: countdown, syllabus, textbooks, past questions, JAMB courses and a pacing plan, all from real records.
exports.hub = async (req, res) => {
  const uid = req.user.id;
  const [countdown, mats, courses] = await Promise.all([
    Setting.publicCountdown(),
    Material.find({ status: "published", examTags: { $in: UTME_TAGS } }).select("-body -images").populate("subject", "name slug").sort({ featured: -1, updatedAt: -1 }).limit(100).lean(),
    Course.find({ status: "published", examTags: { $in: UTME_TAGS } }).populate("subject", "name slug").sort({ featured: -1, publishedAt: -1 }).limit(40).lean(),
  ]);
  const views = isAdmin(req) ? {} : await viewsFor(uid, mats.map((m) => m._id));
  const stats = await main._h.statsFor(uid, courses.map((c) => c._id));
  const cards = await main._h.cards(courses);
  const courseRows = cards.map((c) => ({ course: c, progress: stats[String(c.id)] }));
  const remaining = courseRows.reduce((n, r) => n + Math.max(0, r.progress.total - r.progress.completed), 0);
  const days = countdown ? daysLeft(countdown.targetDate) : null;
  const by = (k) => mats.filter((m) => m.kind === k).map((m) => card(m, views[String(m._id)]));
  res.json({
    countdown,
    plan: countdown && courseRows.length ? studyPlan(days, remaining) : null,
    syllabus: by("syllabus"), textbooks: by("textbook"), pastQuestions: by("past-questions"), notes: by("notes"),
    courses: courseRows,
  });
};
