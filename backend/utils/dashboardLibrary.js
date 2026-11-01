// Pure mapping from Library progress rows to the dashboard's "recently opened" section (no database here).
// Rows come from LibraryProgress joined to the lesson. Rules:
//  - Only PUBLISHED lessons are shown (a lesson an admin has since unpublished disappears).
//  - A PDF shows "page X of Y" only when the Library has recorded a page count; a video shows a resume time only when
//    a position was saved. Nothing is guessed.
//  - Newest first, at most LIMIT items. Completed lessons stay in the list but are flagged.
const LIMIT = 5;
const toMs = (v) => (v ? new Date(v).getTime() : 0);
const idOf = (v) => (v == null ? "" : String(v));

function mapRow(p) {
  const l = p.lesson;
  const isPdf = l.contentType === "pdf";
  const isVideo = l.contentType === "video";
  return {
    id: idOf(l._id ?? l.id),
    title: l.title,
    contentType: l.contentType,
    courseId: idOf(l.course),
    lastOpenedAt: p.lastOpenedAt || null,
    completed: Boolean(p.completed),
    lastPage: isPdf && p.pageCount > 0 && p.lastPage >= 1 ? Math.min(p.lastPage, p.pageCount) : null,
    pageCount: isPdf && p.pageCount > 0 ? p.pageCount : null,
    positionSec: isVideo && p.lastPositionSec > 0 ? Math.round(p.lastPositionSec) : null,
  };
}

function buildLibrarySection({ progress = [], totals = {} } = {}) {
  const recent = progress
    .filter((p) => p && p.lesson && p.lesson.status === "published")
    .sort((a, b) => toMs(b.lastOpenedAt) - toMs(a.lastOpenedAt))
    .slice(0, LIMIT)
    .map(mapRow);
  return {
    available: true,
    summary: {
      lessonsCompleted: totals.completed || 0,
      lessonsOpened: totals.opened || 0,
      // reading time plus video time actually watched, the same formula the Library's own summary uses
      studyMinutes: Math.round(((totals.seconds || 0) + (totals.watched || 0)) / 60),
    },
    recent,
  };
}

module.exports = { buildLibrarySection, LIMIT };
