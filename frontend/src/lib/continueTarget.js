// Chooses the ONE best thing for a student to carry on with, from the real dashboard data. Pure and dependency-free.
// Priority (each rule is visible here, nothing is invented):
//   1. An examination that is running: it has a deadline, so it comes first (the one closest to its deadline wins).
//   2. The most recently opened Library lesson that is not completed.
//   3. The top recommended examination (it carries its own reason).
//   4. Nothing to carry on with: returns null and the screen shows no button.

const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const minutesLeft = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min left` : `${Math.max(1, Math.ceil(s / 60))} min left`);
const TYPE = { pdf: "PDF", video: "Video", text: "Reading", link: "Link" };

export function pickContinue(data) {
  if (!data) return null;

  const running = [...(data.continueExams || [])].sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
  if (running) {
    const progress = running.answered != null && running.questionCount ? `${running.answered} of ${running.questionCount} answered` : null;
    return { kind: "exam", to: `/attempts/${running.attemptId}`, label: "Resume examination", title: running.examTitle, detail: [running.subject, progress, minutesLeft(running.secondsLeft)].filter(Boolean).join(" · "), urgent: running.secondsLeft < 600 };
  }

  const lib = data.library;
  const lesson = lib?.available ? (lib.recent || []).find((m) => !m.completed) : null;
  if (lesson) {
    const where = lesson.lastPage ? `Page ${lesson.lastPage} of ${lesson.pageCount}` : lesson.positionSec ? `Resume at ${clock(lesson.positionSec)}` : null;
    return { kind: "lesson", to: `/library/lessons/${lesson.id}`, label: "Continue lesson", title: lesson.title, detail: [TYPE[lesson.contentType] || "Lesson", where].filter(Boolean).join(" · "), urgent: false };
  }

  const reco = (data.recommended || [])[0];
  if (reco) return { kind: "recommended", to: `/exams/${reco.id}`, label: "Start examination", title: reco.title, detail: [reco.subject, reco.reason].filter(Boolean).join(" · "), urgent: false };

  return null;
}
