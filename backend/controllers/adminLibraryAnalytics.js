const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Progress = require("../models/LibraryProgress");
const Enrolment = require("../models/LibraryEnrolment");

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Everything below is computed from stored records. With no student activity the lists are simply empty.
exports.analytics = async (req, res) => {
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const minOpeners = Math.max(1, Math.min(100, Number(req.query.minOpeners) || 5));

  const [courseStatus, enrolTotals, active30, lessonsDone, perCourse, perLesson, videoRows] = await Promise.all([
    Course.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Enrolment.aggregate([{ $group: { _id: null, enrolments: { $sum: 1 }, completed: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } } } }]),
    Progress.distinct("user", { lastOpenedAt: { $gte: since30 } }),
    Progress.countDocuments({ completed: true }),
    Enrolment.aggregate([{ $group: { _id: "$course", enrolments: { $sum: 1 }, completions: { $sum: { $cond: [{ $ifNull: ["$completedAt", false] }, 1, 0] } } } }]),
    Progress.aggregate([{ $group: { _id: "$lesson", openers: { $sum: 1 }, opens: { $sum: "$openCount" }, completers: { $sum: { $cond: ["$completed", 1, 0] } }, practicePassed: { $sum: { $cond: ["$quizPassed", 1, 0] } }, seconds: { $sum: "$activeSeconds" } } }]),
    Progress.aggregate([{ $match: { videoDurationSec: { $gt: 0 } } }, { $group: { _id: "$lesson", viewers: { $sum: 1 }, avgWatched: { $avg: { $divide: ["$maxWatchedSec", "$videoDurationSec"] } } } }]),
  ]);

  const courses = await Course.find({ _id: { $in: perCourse.map((c) => c._id) } }).select("title slug status").lean();
  const lessons = await Lesson.find({ _id: { $in: perLesson.map((l) => l._id) } }).select("title course module contentType practice").populate({ path: "course", select: "title" }).lean();
  const lMap = Object.fromEntries(lessons.map((l) => [String(l._id), l]));
  const cMap = Object.fromEntries(courses.map((c) => [String(c._id), c]));

  const topCourses = perCourse.filter((c) => cMap[String(c._id)])
    .map((c) => ({ id: c._id, title: cMap[String(c._id)].title, status: cMap[String(c._id)].status, enrolments: c.enrolments, completions: c.completions, completionRate: pct(c.completions, c.enrolments) }))
    .sort((a, b) => b.enrolments - a.enrolments).slice(0, 10);

  const lessonRows = perLesson.filter((l) => lMap[String(l._id)]).map((l) => {
    const info = lMap[String(l._id)];
    return { id: l._id, title: info.title, course: info.course && info.course.title, contentType: info.contentType, openers: l.openers, opens: l.opens, completers: l.completers, completionRate: pct(l.completers, l.openers), hasPractice: !!(info.practice && info.practice.exam), practicePassed: l.practicePassed };
  });

  const video = videoRows.filter((r) => lMap[String(r._id)]).map((r) => ({ id: r._id, title: lMap[String(r._id)].title, viewers: r.viewers, avgWatchedPercent: Math.round(r.avgWatched * 100) }))
    .sort((a, b) => b.viewers - a.viewers).slice(0, 10);

  const e = enrolTotals[0] || { enrolments: 0, completed: 0 };
  res.json({
    totals: {
      coursesByStatus: Object.fromEntries(courseStatus.map((s) => [s._id, s.n])),
      enrolments: e.enrolments, courseCompletions: e.completed, courseCompletionRate: pct(e.completed, e.enrolments),
      activeLearners30d: active30.length, lessonsCompleted: lessonsDone,
    },
    topCourses,
    mostViewedLessons: [...lessonRows].sort((a, b) => b.opens - a.opens).slice(0, 10),
    // Lessons many students open but few finish: where students tend to stop. Needs at least `minOpeners` students to mean anything.
    dropOff: lessonRows.filter((l) => l.openers >= minOpeners).sort((a, b) => a.completionRate - b.completionRate).slice(0, 10),
    videoEngagement: video,
    practice: lessonRows.filter((l) => l.hasPractice).map((l) => ({ id: l.id, title: l.title, openers: l.openers, passed: l.practicePassed, passRate: pct(l.practicePassed, l.openers) })).slice(0, 20),
    minOpeners,
  });
};
