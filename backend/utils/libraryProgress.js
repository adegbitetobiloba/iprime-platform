// Completion rules. Opening a lesson NEVER completes it.
// `progress` is what the server has stored for the student, not what the browser claims.
const VIDEO_COMPLETE_FRACTION = 0.9;
const MIN_READ_FRACTION = 0.5; // of the estimated reading time

function isLessonComplete(lesson, progress = {}) {
  if (lesson.requiresQuizPass && !progress.quizPassed) return false;
  switch (lesson.contentType) {
    case "video": {
      const d = Number(progress.videoDurationSec) || 0;
      return d > 0 && (Number(progress.maxWatchedSec) || 0) / d >= VIDEO_COMPLETE_FRACTION;
    }
    case "pdf": {
      const total = Number(progress.pageCount) || 0;
      return total > 0 && (Number(progress.maxPageReached) || 0) >= total;
    }
    case "text": {
      const need = Math.max(10, (Number(lesson.estimatedMinutes) || 1) * 60 * MIN_READ_FRACTION);
      return !!progress.reachedEnd && (Number(progress.activeSeconds) || 0) >= need;
    }
    case "link":
      return !!progress.markedDone; // external content cannot be observed; the student confirms
    default:
      return false;
  }
}

function coursePercent(completedCount, totalCount) {
  if (!totalCount) return 0;
  return Math.min(100, Math.round((completedCount / totalCount) * 100));
}

// Soft anti-skip guard: "watched" time can only grow about as fast as real time allows (up to ~2.5x speed plus a small allowance).
// It cannot stop a determined student; it stops a single request from claiming the whole video was watched.
function limitedGrowth(prevMax, reportedPos, secondsSinceLastEvent) {
  const allowance = Math.max(30, (secondsSinceLastEvent || 0) * 2.5 + 10);
  return Math.max(prevMax, Math.min(reportedPos, prevMax + allowance));
}

// Where "Continue" should go: the last lesson if it is not finished, otherwise the first unfinished lesson in course order.
// `lessons` must already be in course order (chapter order, then lesson order) and contain only published lessons.
function pickNextLesson(lessons, completedIds, lastLessonId) {
  const done = new Set([...completedIds].map(String));
  if (lastLessonId && lessons.some((l) => String(l.id) === String(lastLessonId) && !done.has(String(l.id)))) {
    return lessons.find((l) => String(l.id) === String(lastLessonId));
  }
  return lessons.find((l) => !done.has(String(l.id))) || null;
}

module.exports = { isLessonComplete, coursePercent, limitedGrowth, pickNextLesson, VIDEO_COMPLETE_FRACTION, MIN_READ_FRACTION };
