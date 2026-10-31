const mongoose = require("mongoose");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const CourseModule = require("../models/CourseModule");
const Lesson = require("../models/Lesson");
const Progress = require("../models/LibraryProgress");
const Enrolment = require("../models/LibraryEnrolment");
const Bookmark = require("../models/LibraryBookmark");
const Note = require("../models/LibraryNote");
const LibraryFile = require("../models/LibraryFile");
const { isLessonComplete, limitedGrowth, pickNextLesson, coursePercent } = require("../utils/libraryProgress");

const PRACTICE_PASS_MARK = 50; // percent on the linked exam needed to count as a passed knowledge check
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isId = (v) => mongoose.isValidObjectId(v);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
const isAdmin = (req) => req.user.role === "admin"; // set by requireRole; admins preview content and never create learning records

exports.idParams = (req, res, next, value) => (isId(value) ? next() : bad(res, "Not found", 404));

// ---------- shapes sent to the browser (never raw documents) ----------
const courseCard = (c, lessonCount) => ({
  id: c._id, slug: c.slug, title: c.title, description: c.description, coverImageUrl: c.coverImageUrl,
  subject: c.subject && c.subject.name ? { name: c.subject.name, slug: c.subject.slug } : undefined,
  examTags: c.examTags, difficulty: c.difficulty, estimatedMinutes: c.estimatedMinutes, featured: c.featured,
  lessonCount: lessonCount || 0,
});
const lessonBrief = (l) => ({
  id: l._id, title: l.title, contentType: l.contentType, estimatedMinutes: l.estimatedMinutes,
  module: l.module, topicId: l.topicId, order: l.order, requiresQuizPass: l.requiresQuizPass, hasPractice: !!(l.practice && l.practice.exam),
});

async function lessonCounts(courseIds) {
  const rows = await Lesson.aggregate([
    { $match: { course: { $in: courseIds }, status: "published" } },
    { $group: { _id: "$course", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
}

async function cards(courses) {
  const counts = await lessonCounts(courses.map((c) => c._id));
  return courses.map((c) => courseCard(c, counts[String(c._id)]));
}

// Published lessons of a course, in course order (chapter order, then lesson order).
async function orderedLessons(courseId) {
  const [mods, lessons] = await Promise.all([
    CourseModule.find({ course: courseId }).sort({ order: 1 }).lean(),
    Lesson.find({ course: courseId, status: "published" }).sort({ order: 1 }).lean(),
  ]);
  const rank = Object.fromEntries(mods.map((m, i) => [String(m._id), i]));
  lessons.sort((a, b) => (rank[String(a.module)] - rank[String(b.module)]) || (a.order - b.order));
  return { mods, lessons };
}

async function statsFor(userId, courseIds) {
  const [totals, done] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: courseIds }, status: "published" } }, { $group: { _id: "$course", n: { $sum: 1 } } }]),
    Progress.aggregate([{ $match: { user: new mongoose.Types.ObjectId(userId), course: { $in: courseIds }, completed: true } }, { $group: { _id: "$course", n: { $sum: 1 } } }]),
  ]);
  const t = Object.fromEntries(totals.map((r) => [String(r._id), r.n]));
  const d = Object.fromEntries(done.map((r) => [String(r._id), r.n]));
  return Object.fromEntries(courseIds.map((id) => {
    const total = t[String(id)] || 0;
    const completed = Math.min(d[String(id)] || 0, total);
    return [String(id), { total, completed, percent: coursePercent(completed, total) }];
  }));
}

async function refreshEnrolment(userId, courseId, lessonId) {
  const stats = (await statsFor(userId, [new mongoose.Types.ObjectId(courseId)]))[String(courseId)];
  const set = { lastActiveAt: new Date() };
  if (lessonId) set.lastLesson = lessonId;
  const e = await Enrolment.findOneAndUpdate({ user: userId, course: courseId }, { $set: set, $setOnInsert: { startedAt: new Date() } }, { upsert: true, new: true });
  if (stats.total > 0 && stats.completed >= stats.total && !e.completedAt) {
    e.completedAt = new Date();
    await e.save();
  }
  return stats;
}

// ---------- discovery ----------
exports.home = async (req, res) => {
  const uid = req.user.id;
  const published = { status: "published" };
  const [subjects, tagRows, featured, recent, popularRows, enrols, viewed, bookmarkCount] = await Promise.all([
    Subject.find({ status: "active" }).sort({ group: 1, order: 1, name: 1 }).lean(),
    Course.aggregate([{ $match: published }, { $unwind: "$examTags" }, { $group: { _id: "$examTags", n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }]),
    Course.find({ ...published, featured: true }).populate("subject", "name slug").sort({ publishedAt: -1 }).limit(6).lean(),
    Course.find(published).populate("subject", "name slug").sort({ publishedAt: -1 }).limit(8).lean(),
    Enrolment.aggregate([{ $group: { _id: "$course", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]),
    Enrolment.find({ user: uid, completedAt: { $exists: false } }).sort({ lastActiveAt: -1 }).limit(6).lean(),
    Progress.find({ user: uid }).sort({ lastOpenedAt: -1 }).limit(8).populate({ path: "lesson", select: "title contentType status course" }).lean(),
    Bookmark.countDocuments({ user: uid }),
  ]);

  const subjectCounts = await Course.aggregate([{ $match: published }, { $group: { _id: "$subject", n: { $sum: 1 } } }]);
  const sc = Object.fromEntries(subjectCounts.map((r) => [String(r._id), r.n]));

  // Continue learning
  const contCourses = await Course.find({ _id: { $in: enrols.map((e) => e.course) }, ...published }).populate("subject", "name slug").lean();
  const stats = await statsFor(uid, contCourses.map((c) => c._id));
  const cont = [];
  for (const e of enrols) {
    const c = contCourses.find((x) => String(x._id) === String(e.course));
    if (!c) continue;
    const { lessons } = await orderedLessons(c._id);
    const doneIds = (await Progress.find({ user: uid, course: c._id, completed: true }).select("lesson").lean()).map((p) => p.lesson);
    const next = pickNextLesson(lessons.map((l) => ({ ...l, id: l._id })), doneIds, e.lastLesson);
    if (!next) continue;
    cont.push({ course: courseCard(c, stats[String(c._id)].total), progress: stats[String(c._id)], next: { id: next._id, title: next.title } });
  }

  // Popular: most enrolments among published courses. Empty until students actually enrol.
  const popIds = popularRows.map((r) => r._id);
  const popCourses = await Course.find({ _id: { $in: popIds }, ...published }).populate("subject", "name slug").lean();
  const popular = popIds.map((id) => popCourses.find((c) => String(c._id) === String(id))).filter(Boolean).slice(0, 6);

  res.json({
    subjects: subjects.filter((s) => sc[String(s._id)]).map((s) => ({ id: s._id, name: s.name, slug: s.slug, group: s.group, courseCount: sc[String(s._id)] })),
    examTags: tagRows.map((r) => ({ tag: r._id, courseCount: r.n })),
    featured: await cards(featured),
    recent: await cards(recent),
    popular: await cards(popular),
    continueLearning: cont,
    recentlyViewed: viewed.filter((p) => p.lesson && p.lesson.status === "published").map((p) => ({ lessonId: p.lesson._id, title: p.lesson.title, contentType: p.lesson.contentType, courseId: p.lesson.course, at: p.lastOpenedAt, completed: p.completed })),
    bookmarkCount,
  });
};

exports.listCourses = async (req, res) => {
  const q = { status: "published" };
  if (req.query.subject) {
    const s = await Subject.findOne({ slug: String(req.query.subject) }).select("_id");
    q.subject = s ? s._id : null;
  }
  if (req.query.tag) q.examTags = String(req.query.tag).slice(0, 30);
  if (["beginner", "intermediate", "advanced"].includes(req.query.difficulty)) q.difficulty = req.query.difficulty;
  const courses = await Course.find(q).populate("subject", "name slug").sort({ featured: -1, publishedAt: -1 }).limit(100).lean();
  res.json({ courses: await cards(courses) });
};

exports.search = async (req, res) => {
  const term = String(req.query.q || "").trim().slice(0, 60);
  if (term.length < 2) return res.json({ courses: [], lessons: [] });
  const re = new RegExp(esc(term), "i");
  const subs = await Subject.find({ name: re, status: "active" }).select("_id").lean();
  const courses = await Course.find({ status: "published", $or: [{ title: re }, { description: re }, { examTags: re }, { subject: { $in: subs.map((s) => s._id) } }] })
    .populate("subject", "name slug").limit(20).lean();
  const lessons = await Lesson.find({ status: "published", title: re }).limit(30).populate({ path: "course", select: "title slug status" }).lean();
  res.json({
    courses: await cards(courses),
    lessons: lessons.filter((l) => l.course && l.course.status === "published").slice(0, 20).map((l) => ({ ...lessonBrief(l), course: { id: l.course._id, slug: l.course.slug, title: l.course.title } })),
  });
};

// ---------- a course ----------
exports.getCourse = async (req, res) => {
  const course = await Course.findOne({ slug: String(req.params.slug).toLowerCase() }).populate("subject", "name slug").lean();
  if (!course || (course.status !== "published" && !isAdmin(req))) return bad(res, "Course not found", 404);
  const { mods, lessons } = await (async () => {
    if (course.status === "published") return orderedLessons(course._id);
    const o = await orderedLessons(course._id); // admin preview of an unpublished course: show everything not archived
    o.lessons = await Lesson.find({ course: course._id, status: { $ne: "archived" } }).sort({ order: 1 }).lean();
    return o;
  })();
  const [prog, marks, enrol] = await Promise.all([
    Progress.find({ user: req.user.id, course: course._id }).select("lesson completed lastPositionSec videoDurationSec maxWatchedSec").lean(),
    Bookmark.find({ user: req.user.id, course: course._id }).select("lesson").lean(),
    Enrolment.findOne({ user: req.user.id, course: course._id }).lean(),
  ]);
  const pm = Object.fromEntries(prog.map((p) => [String(p.lesson), p]));
  const bm = new Set(marks.map((b) => String(b.lesson)));
  const done = prog.filter((p) => p.completed).map((p) => p.lesson);
  const flat = lessons.map((l) => ({ ...l, id: l._id }));
  const next = pickNextLesson(flat, done, enrol && enrol.lastLesson);
  const total = lessons.length;
  const completed = lessons.filter((l) => pm[String(l._id)] && pm[String(l._id)].completed).length;
  res.json({
    course: { ...courseCard(course, total), objectives: course.objectives, preview: course.status !== "published" },
    enrolled: !!enrol,
    progress: { total, completed, percent: coursePercent(completed, total) },
    next: next ? { id: next._id, title: next.title } : null,
    modules: mods.map((m) => ({
      id: m._id, title: m.title, description: m.description, topics: m.topics.map((t) => ({ id: t._id, title: t.title })),
      lessons: lessons.filter((l) => String(l.module) === String(m._id)).map((l) => ({
        ...lessonBrief(l), completed: !!(pm[String(l._id)] && pm[String(l._id)].completed), started: !!pm[String(l._id)], bookmarked: bm.has(String(l._id)),
      })),
    })),
  });
};

exports.enrol = async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, status: "published" }).select("_id");
  if (!course) return bad(res, "Course not found", 404);
  if (isAdmin(req)) return res.json({ ok: true, preview: true });
  await Enrolment.updateOne({ user: req.user.id, course: course._id }, { $setOnInsert: { startedAt: new Date(), lastActiveAt: new Date() } }, { upsert: true });
  res.json({ ok: true });
};

// ---------- a lesson ----------
async function loadLesson(req, res) {
  const lesson = await Lesson.findById(req.params.id).lean();
  if (!lesson) { bad(res, "Lesson not found", 404); return null; }
  const course = await Course.findById(lesson.course).populate("subject", "name slug").lean();
  const visible = course && course.status === "published" && lesson.status === "published";
  if (!visible && !isAdmin(req)) { bad(res, "Lesson not found", 404); return null; }
  return { lesson, course };
}

async function practiceInfo(lesson) {
  if (!lesson.practice || !lesson.practice.exam) return null;
  const Exam = mongoose.model("Exam"); // read only; questions and answers are never selected
  const rows = await Exam.aggregate([
    { $match: { _id: lesson.practice.exam, status: "published" } },
    { $project: { title: 1, durationMinutes: 1, questionCount: { $size: { $ifNull: ["$questions", []] } } } },
  ]);
  return rows[0] ? { examId: rows[0]._id, title: rows[0].title, durationMinutes: rows[0].durationMinutes, questionCount: rows[0].questionCount, topic: lesson.practice.topic || undefined, passMark: PRACTICE_PASS_MARK } : null;
}

exports.getLesson = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  const { lesson, course } = loaded;
  const { lessons } = await orderedLessons(course._id);
  const idx = lessons.findIndex((l) => String(l._id) === String(lesson._id));
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const mod = await CourseModule.findById(lesson.module).select("title topics").lean();
  const topic = mod && lesson.topicId ? mod.topics.find((t) => String(t._id) === String(lesson.topicId)) : null;

  let progress = null, bookmarked = false, note = "";
  if (!isAdmin(req)) {
    const now = new Date();
    progress = await Progress.findOneAndUpdate(
      { user: req.user.id, lesson: lesson._id },
      { $set: { lastOpenedAt: now, course: course._id }, $setOnInsert: { firstOpenedAt: now }, $inc: { openCount: 1 } },
      { upsert: true, new: true }
    ).lean();
    await Enrolment.findOneAndUpdate({ user: req.user.id, course: course._id }, { $set: { lastLesson: lesson._id, lastActiveAt: now }, $setOnInsert: { startedAt: now } }, { upsert: true });
    const [b, n] = await Promise.all([Bookmark.exists({ user: req.user.id, lesson: lesson._id }), Note.findOne({ user: req.user.id, lesson: lesson._id }).select("text").lean()]);
    bookmarked = !!b;
    note = n ? n.text : "";
  }

  const related = await Lesson.find({ course: course._id, module: lesson.module, status: "published", _id: { $ne: lesson._id } }).sort({ order: 1 }).limit(4).lean();

  res.json({
    preview: isAdmin(req) && !(course.status === "published" && lesson.status === "published"),
    lesson: {
      ...lessonBrief(lesson),
      body: lesson.contentType === "text" ? lesson.body : undefined,
      video: lesson.contentType === "video" ? { provider: lesson.video.provider, videoId: lesson.video.videoId } : undefined,
      externalUrl: lesson.contentType === "link" ? lesson.externalUrl : undefined,
      pdf: lesson.contentType === "pdf" ? { available: !!(lesson.pdf && lesson.pdf.file), name: lesson.pdf && lesson.pdf.originalName } : undefined, // never the file id
      moduleTitle: mod && mod.title, topicTitle: topic && topic.title,
    },
    course: { id: course._id, slug: course.slug, title: course.title, subject: course.subject && course.subject.name },
    prev: prev ? { id: prev._id, title: prev.title } : null,
    next: next ? { id: next._id, title: next.title } : null,
    related: related.map((l) => ({ id: l._id, title: l.title, contentType: l.contentType, estimatedMinutes: l.estimatedMinutes })),
    practice: await practiceInfo(lesson),
    progress: progress ? {
      completed: progress.completed, lastPositionSec: progress.lastPositionSec, lastPage: progress.lastPage,
      watchedPercent: progress.videoDurationSec ? Math.round((progress.maxWatchedSec / progress.videoDurationSec) * 100) : 0,
      quizPassed: progress.quizPassed, markedDone: progress.markedDone,
    } : null,
    bookmarked, note,
  });
};

exports.saveProgress = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  if (isAdmin(req)) return res.json({ ok: true, preview: true, completed: false });
  const { lesson } = loaded;
  const b = req.body;
  const now = new Date();
  const p = (await Progress.findOne({ user: req.user.id, lesson: lesson._id })) || new Progress({ user: req.user.id, lesson: lesson._id, course: lesson.course, firstOpenedAt: now, lastOpenedAt: now });
  const since = p.lastEventAt ? (now - p.lastEventAt) / 1000 : 0;

  if (lesson.contentType === "video") {
    if (b.videoDurationSec) p.videoDurationSec = clamp(b.videoDurationSec, 0, 21600);
    if (b.videoPositionSec !== undefined) {
      const pos = clamp(b.videoPositionSec, 0, p.videoDurationSec || 21600);
      p.lastPositionSec = pos;
      p.maxWatchedSec = limitedGrowth(p.maxWatchedSec, pos, since);
    }
  }
  if (lesson.contentType === "pdf") {
    if (b.pageCount) p.pageCount = clamp(b.pageCount, 1, 5000);
    if (b.page) {
      const pg = clamp(b.page, 1, p.pageCount || 5000);
      p.lastPage = pg;
      p.maxPageReached = Math.max(p.maxPageReached, Math.min(pg, p.maxPageReached + 3));
    }
  }
  if (lesson.contentType === "text") {
    if (b.activeSecondsDelta) p.activeSeconds += p.lastEventAt ? Math.min(clamp(b.activeSecondsDelta, 0, 60), since + 5) : Math.min(clamp(b.activeSecondsDelta, 0, 60), 5);
    if (b.reachedEnd) p.reachedEnd = true;
  }
  if (lesson.contentType === "link" && b.markedDone) p.markedDone = true;

  p.lastEventAt = now;
  let justCompleted = false;
  if (!p.completed && isLessonComplete(lesson, p)) {
    p.completed = true;
    p.completedAt = now;
    justCompleted = true;
  }
  await p.save();
  const stats = justCompleted ? await refreshEnrolment(req.user.id, lesson.course, lesson._id) : undefined;
  res.json({ ok: true, completed: p.completed, justCompleted, course: stats });
};

// Reads the student's own submitted attempts on the linked exam (read only) to decide whether the knowledge check is passed.
exports.checkPractice = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  const { lesson } = loaded;
  if (!lesson.practice || !lesson.practice.exam) return bad(res, "This lesson has no practice exam.");
  if (isAdmin(req)) return res.json({ attempted: false, passed: false, passMark: PRACTICE_PASS_MARK, preview: true });
  const Attempt = mongoose.model("Attempt");
  const best = await Attempt.findOne({ userId: req.user.id, examId: lesson.practice.exam, status: "submitted" }).sort({ percentage: -1 }).select("percentage").lean();
  const passed = !!best && best.percentage >= PRACTICE_PASS_MARK;
  let completed = false;
  const p = (await Progress.findOne({ user: req.user.id, lesson: lesson._id })) || new Progress({ user: req.user.id, lesson: lesson._id, course: lesson.course, firstOpenedAt: new Date(), lastOpenedAt: new Date() });
  if (passed && !p.quizPassed) p.quizPassed = true;
  if (!p.completed && isLessonComplete(lesson, p)) { p.completed = true; p.completedAt = new Date(); completed = true; }
  await p.save();
  if (completed) await refreshEnrolment(req.user.id, lesson.course, lesson._id);
  res.json({ attempted: !!best, bestPercentage: best ? best.percentage : null, passed, passMark: PRACTICE_PASS_MARK, completed: p.completed });
};

// ---------- bookmarks and notes ----------
exports.addBookmark = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  if (isAdmin(req)) return res.json({ bookmarked: true, preview: true });
  await Bookmark.updateOne({ user: req.user.id, lesson: loaded.lesson._id }, { $setOnInsert: { course: loaded.lesson.course } }, { upsert: true });
  res.json({ bookmarked: true });
};
exports.removeBookmark = async (req, res) => {
  await Bookmark.deleteOne({ user: req.user.id, lesson: req.params.id });
  res.json({ bookmarked: false });
};
exports.listBookmarks = async (req, res) => {
  const rows = await Bookmark.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100)
    .populate({ path: "lesson", select: "title contentType status estimatedMinutes" }).populate({ path: "course", select: "title slug status" }).lean();
  res.json({ bookmarks: rows.filter((r) => r.lesson && r.course && r.lesson.status === "published" && r.course.status === "published")
    .map((r) => ({ lessonId: r.lesson._id, title: r.lesson.title, contentType: r.lesson.contentType, estimatedMinutes: r.lesson.estimatedMinutes, course: { slug: r.course.slug, title: r.course.title } })) });
};

exports.saveNote = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  if (isAdmin(req)) return res.json({ ok: true, preview: true });
  if (!req.body.text) await Note.deleteOne({ user: req.user.id, lesson: loaded.lesson._id });
  else await Note.updateOne({ user: req.user.id, lesson: loaded.lesson._id }, { $set: { text: req.body.text } }, { upsert: true });
  res.json({ ok: true });
};

// ---------- summary for the Student Dashboard ----------
exports.mySummary = async (req, res) => {
  const uid = new mongoose.Types.ObjectId(req.user.id);
  const [enrols, agg, bookmarks] = await Promise.all([
    Enrolment.find({ user: uid }).sort({ lastActiveAt: -1 }).limit(20).lean(),
    Progress.aggregate([{ $match: { user: uid } }, { $group: { _id: null, completed: { $sum: { $cond: ["$completed", 1, 0] } }, seconds: { $sum: "$activeSeconds" }, watched: { $sum: "$maxWatchedSec" }, opened: { $sum: 1 } } }]),
    Bookmark.countDocuments({ user: uid }),
  ]);
  const courses = await Course.find({ _id: { $in: enrols.map((e) => e.course) }, status: "published" }).select("title slug").lean();
  const stats = await statsFor(req.user.id, courses.map((c) => c._id));
  const a = agg[0] || { completed: 0, seconds: 0, watched: 0, opened: 0 };
  res.json({
    coursesStarted: courses.length,
    coursesCompleted: enrols.filter((e) => e.completedAt && courses.some((c) => String(c._id) === String(e.course))).length,
    lessonsCompleted: a.completed,
    lessonsOpened: a.opened,
    studyMinutes: Math.round((a.seconds + a.watched) / 60), // reading time plus video time actually watched
    bookmarks,
    courses: courses.map((c) => ({ id: c._id, slug: c.slug, title: c.title, ...stats[String(c._id)] })),
  });
};

// Streams a lesson PDF to a signed-in student who may see the lesson. No permanent link exists: every request is authenticated,
// and the response asks browsers and proxies not to store it. (This cannot stop screenshots or screen recording.)
exports.streamPdf = async (req, res) => {
  const loaded = await loadLesson(req, res);
  if (!loaded) return;
  const { lesson } = loaded;
  if (lesson.contentType !== "pdf" || !(lesson.pdf && lesson.pdf.file)) return bad(res, "No document is attached to this lesson.", 404);
  const file = await LibraryFile.findById(lesson.pdf.file).select("+data size sha256");
  if (!file) return bad(res, "The document could not be found.", 404);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Length": String(file.size),
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(file.data);
};
