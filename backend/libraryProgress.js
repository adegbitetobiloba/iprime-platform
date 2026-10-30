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

module.exports = { isLessonComplete, coursePercent, VIDEO_COMPLETE_FRACTION, MIN_READ_FRACTION };
