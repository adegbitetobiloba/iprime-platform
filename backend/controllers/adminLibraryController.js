const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const LibraryFile = require("../models/LibraryFile");
const crypto = require("crypto");
const { checkPdfBuffer, safeFileName } = require("../utils/libraryPdf");
const { slugify, canTransition, parseVideoUrl, publishProblems, lessonHasContent, STATUSES } = require("../utils/library");

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isId = (v) => mongoose.isValidObjectId(v);
const CI = { locale: "en", strength: 2 }; // case-insensitive name matching

// Router param guard: an :id that is not an ObjectId is a 404, not a 500.
exports.idParams = (req, res, next, value) => (isId(value) ? next() : bad(res, "Not found", 404));

async function uniqueSlug(Model, base, excludeId) {
  let slug = base;
  let n = 2;
  while (await Model.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) slug = `${base}-${n++}`;
  return slug;
}

// ---- Subjects ----
exports.listSubjects = async (req, res) => {
  res.json({ subjects: await Subject.find().sort({ group: 1, order: 1, name: 1 }).lean() });
};

exports.createSubject = async (req, res) => {
  if (await Subject.findOne({ name: req.body.name }).collation(CI)) return bad(res, "A subject with this name already exists.", 409);
  const slug = await uniqueSlug(Subject, slugify(req.body.name));
  res.status(201).json({ subject: await Subject.create({ ...req.body, slug }) });
};

exports.updateSubject = async (req, res) => {
  const s = await Subject.findById(req.params.id);
  if (!s) return bad(res, "Not found", 404);
  if (req.body.name && req.body.name !== s.name) {
    const dup = await Subject.findOne({ name: req.body.name, _id: { $ne: s._id } }).collation(CI);
    if (dup) return bad(res, "A subject with this name already exists.", 409);
  }
  Object.assign(s, req.body);
  await s.save();
  res.json({ subject: s });
};

// ---- Courses ----
exports.listCourses = async (req, res) => {
  const q = {};
  if (STATUSES.includes(req.query.status)) q.status = req.query.status;
  if (isId(req.query.subject)) q.subject = req.query.subject;
  const courses = await Course.find(q).populate("subject", "name slug").sort({ updatedAt: -1 }).limit(200).lean();
  const counts = await Lesson.aggregate([
    { $match: { course: { $in: courses.map((c) => c._id) }, status: { $ne: "archived" } } },
    { $group: { _id: "$course", n: { $sum: 1 } } },
  ]);
  const byCourse = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({ courses: courses.map((c) => ({ ...c, lessonCount: byCourse[String(c._id)] || 0 })) });
};

exports.createCourse = async (req, res) => {
  if (!(await Subject.exists({ _id: req.body.subject, status: "active" }))) return bad(res, "Choose an active subject.");
  const slug = await uniqueSlug(Course, slugify(req.body.title));
  const course = await Course.create({ ...req.body, slug, status: "draft", createdBy: req.user.id, updatedBy: req.user.id });
  res.status(201).json({ course });
};

exports.getCourse = async (req, res) => {
  const course = await Course.findById(req.params.id).populate("subject", "name slug").lean();
  if (!course) return bad(res, "Not found", 404);
  const [modules, lessons] = await Promise.all([
    CourseModule.find({ course: course._id }).sort({ order: 1 }).lean(),
    Lesson.find({ course: course._id }).sort({ order: 1 }).lean(), // file bytes live in LibraryFile and are never loaded here
  ]);
  res.json({ course, modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => String(l.module) === String(m._id)) })) });
};

exports.updateCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return bad(res, "Not found", 404);
  if (req.body.subject && !(await Subject.exists({ _id: req.body.subject, status: "active" }))) return bad(res, "Choose an active subject.");
  Object.assign(course, req.body, { updatedBy: req.user.id });
  await course.save(); // the slug stays stable on purpose so shared links keep working
  res.json({ course });
};

exports.setCourseStatus = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return bad(res, "Not found", 404);
  const to = req.body.status;
  if (to === course.status) return res.json({ course });
  if (!canTransition(course.status, to)) return bad(res, `A ${course.status} course cannot become ${to}.`, 409);
  if (to === "published") {
    const lessons = await Lesson.find({ course: course._id }).lean();
    const problems = publishProblems(course, lessons);
    if (problems.length) return res.status(422).json({ error: "This course is not ready to publish.", errors: problems });
    if (!course.publishedAt) course.publishedAt = new Date();
  }
  let lessonsPublished = 0;
  let lessonsLeftInDraft = 0;
  if (to === "published") {
    // Publishing a course also publishes its draft/review lessons that have content. Lessons without content stay hidden.
    const pending = await Lesson.find({ course: course._id, status: { $in: ["draft", "review"] } }).lean();
    const ready = pending.filter(lessonHasContent).map((l) => l._id);
    lessonsLeftInDraft = pending.length - ready.length;
    if (ready.length) lessonsPublished = (await Lesson.updateMany({ _id: { $in: ready } }, { $set: { status: "published", updatedBy: req.user.id } })).modifiedCount;
  }
  course.status = to;
  course.updatedBy = req.user.id;
  await course.save();
  res.json({ course, lessonsPublished, lessonsLeftInDraft });
};

// ---- Modules (chapters) and topics ----
exports.createModule = async (req, res) => {
  const course = await Course.findById(req.params.id).select("_id");
  if (!course) return bad(res, "Not found", 404);
  const last = await CourseModule.findOne({ course: course._id }).sort({ order: -1 }).select("order");
  const m = await CourseModule.create({ ...req.body, course: course._id, order: last ? last.order + 1 : 0 });
  res.status(201).json({ module: m });
};

exports.updateModule = async (req, res) => {
  const m = await CourseModule.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  if (req.body.topics) {
    // A topic that still has lessons cannot be dropped silently.
    const keep = new Set(req.body.topics.filter((t) => t._id).map((t) => String(t._id)));
    const removed = m.topics.map((t) => String(t._id)).filter((tid) => !keep.has(tid));
    if (removed.length && (await Lesson.exists({ module: m._id, topicId: { $in: removed } }))) {
      return bad(res, "Move or remove the lessons in a topic before deleting it.", 409);
    }
  }
  Object.assign(m, req.body);
  await m.save();
  res.json({ module: m });
};

exports.deleteModule = async (req, res) => {
  const m = await CourseModule.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  if (await Lesson.exists({ module: m._id })) return bad(res, "Remove or move the lessons in this chapter first.", 409);
  await m.deleteOne();
  res.json({ ok: true });
};

exports.reorderModules = async (req, res) => {
  const mods = await CourseModule.find({ course: req.params.id }).select("_id");
  const have = new Set(mods.map((m) => String(m._id)));
  if (req.body.ids.length !== have.size || !req.body.ids.every((i) => have.has(i))) return bad(res, "The list must contain every chapter of this course exactly once.");
  await CourseModule.bulkWrite(req.body.ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  res.json({ ok: true });
};

// ---- Lessons ----
function applyVideo(lesson, videoUrl) {
  if (videoUrl === undefined) return null;
  if (!videoUrl) {
    lesson.video = undefined;
    return null;
  }
  const v = parseVideoUrl(videoUrl);
  if (!v) return "Only https YouTube and Vimeo links are supported.";
  lesson.video = v;
  return null;
}

async function checkRefs(moduleDoc, body) {
  if (body.topicId && !moduleDoc.topics.id(body.topicId)) return "That topic is not in this chapter.";
  if (body.practice && body.practice.exam) {
    const Exam = mongoose.model("Exam"); // existing model, read only: the Library never edits exams or questions
    if (!(await Exam.exists({ _id: body.practice.exam }))) return "The selected practice exam does not exist.";
  }
  return null;
}

exports.createLesson = async (req, res) => {
  const m = await CourseModule.findById(req.params.id);
  if (!m) return bad(res, "Not found", 404);
  const { videoUrl, ...rest } = req.body;
  const refErr = await checkRefs(m, rest);
  if (refErr) return bad(res, refErr);
  const last = await Lesson.findOne({ module: m._id }).sort({ order: -1 }).select("order");
  const lesson = new Lesson({ ...rest, course: m.course, module: m._id, order: last ? last.order + 1 : 0, createdBy: req.user.id, updatedBy: req.user.id });
  const err = applyVideo(lesson, videoUrl);
  if (err) return bad(res, err);
  if (rest.contentType === "video" && !(lesson.video && lesson.video.videoId)) return bad(res, "Add a YouTube or Vimeo link for a video lesson.");
  await lesson.save();
  res.status(201).json({ lesson });
};

exports.updateLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return bad(res, "Not found", 404);
  const m = await CourseModule.findById(lesson.module);
  const { videoUrl, ...rest } = req.body;
  const refErr = await checkRefs(m, rest);
  if (refErr) return bad(res, refErr);
  if (rest.status && rest.status !== lesson.status && !canTransition(lesson.status, rest.status)) {
    return bad(res, `A ${lesson.status} lesson cannot become ${rest.status}.`, 409);
  }
  Object.assign(lesson, rest, { updatedBy: req.user.id });
  const err = applyVideo(lesson, videoUrl);
  if (err) return bad(res, err);
  await lesson.save();
  res.json({ lesson });
};

exports.deleteLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return bad(res, "Not found", 404);
  const course = await Course.findById(lesson.course).select("status");
  // Never delete learning content students may already have progress on: archive it instead.
  if (course && course.status !== "draft") return bad(res, "Archive this lesson instead. Only lessons in draft courses can be deleted.", 409);
  await lesson.deleteOne();
  res.json({ ok: true });
};

exports.reorderLessons = async (req, res) => {
  const lessons = await Lesson.find({ module: req.params.id }).select("_id");
  const have = new Set(lessons.map((l) => String(l._id)));
  if (req.body.ids.length !== have.size || !req.body.ids.every((i) => have.has(i))) return bad(res, "The list must contain every lesson of this chapter exactly once.");
  await Lesson.bulkWrite(req.body.ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  res.json({ ok: true });
};

// Upload or replace a lesson's PDF. The file is the raw request body (Content-Type: application/pdf), so no extra upload package is needed.
exports.uploadPdf = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return bad(res, "Not found", 404);
  if (lesson.contentType !== "pdf") return bad(res, "This lesson is not a PDF lesson.", 409);
  const problem = checkPdfBuffer(req.body);
  if (problem) return bad(res, problem, req.body && req.body.length > 0 ? 422 : 400);
  const file = await LibraryFile.create({
    data: req.body, size: req.body.length, sha256: crypto.createHash("sha256").update(req.body).digest("hex"),
    originalName: safeFileName(req.headers["x-file-name"]), uploadedBy: req.user.id,
  });
  const old = lesson.pdf && lesson.pdf.file;
  lesson.pdf = { file: file._id, originalName: file.originalName, size: file.size };
  lesson.updatedBy = req.user.id;
  await lesson.save();
  if (old) await LibraryFile.deleteOne({ _id: old }); // the replaced file is removed, not kept
  res.json({ lesson });
};
