// Pure logic for the student dashboard (no database, no Express) so it can be unit-tested on its own.
// Everything here is derived from the student's own saved attempts and the published examinations.
// Nothing is invented: when there is no data, the result says so (null / empty arrays).

const round1 = (n) => Math.round(n * 10) / 10;
const toMs = (v) => (v ? new Date(v).getTime() : NaN);
const idOf = (v) => (v == null ? "" : String(v));

// Same rule the examination centre uses: published, and inside its availability window.
function isOpen(exam, now) {
  if (!exam || exam.status !== "published") return false;
  const t = now.getTime();
  const from = toMs(exam.availableFrom);
  const until = toMs(exam.availableUntil);
  if (!Number.isNaN(from) && from > t) return false;
  if (!Number.isNaN(until) && until < t) return false;
  return true;
}

function average(nums) {
  const xs = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

const attemptSummary = (a, exam) => ({
  id: idOf(a._id ?? a.id),
  examId: idOf(a.examId),
  examTitle: exam?.title || "Examination",
  subject: exam?.subject || null,
  submittedAt: a.submittedAt || null,
  score: a.score ?? 0,
  totalMarks: a.totalMarks ?? 0,
  percentage: typeof a.percentage === "number" ? a.percentage : 0,
  correct: a.correct ?? 0,
  incorrect: a.incorrect ?? 0,
  unanswered: a.unanswered ?? 0,
  autoSubmitted: Boolean(a.autoSubmitted),
});

// submitted:  the student's submitted attempts (any order)
// inProgress: the student's attempts still running
// exams:      published exams plus any exam the student has attempted (plain objects, with questionCount)
function buildDashboard({ submitted = [], inProgress = [], exams = [], now = new Date() }) {
  const examById = new Map(exams.map((e) => [idOf(e._id ?? e.id), e]));
  const sorted = [...submitted].sort((a, b) => toMs(b.submittedAt) - toMs(a.submittedAt)); // newest first
  const chronological = [...sorted].reverse();

  // ---- headline numbers -------------------------------------------------------------------------------------
  const percentages = sorted.map((a) => a.percentage);
  const latest = sorted[0];
  const earlier = sorted.slice(1).map((a) => a.percentage);
  const earlierAvg = average(earlier);
  const stats = {
    attempted: sorted.length,
    examsTaken: new Set(sorted.map((a) => idOf(a.examId))).size,
    averagePercentage: average(percentages),
    bestPercentage: sorted.length ? Math.max(...percentages) : null,
    latestPercentage: latest ? latest.percentage : null,
    // latest result compared with the average of the earlier ones; null until there are two results
    changeFromEarlier: latest && earlierAvg !== null ? round1(latest.percentage - earlierAvg) : null,
  };

  // ---- per-subject performance (only subjects the student has actually written) ------------------------------
  const bySubject = new Map();
  for (const a of sorted) {
    const subject = examById.get(idOf(a.examId))?.subject;
    if (!subject) continue;
    const row = bySubject.get(subject) || { subject, attempts: 0, percentages: [] };
    row.attempts += 1;
    row.percentages.push(a.percentage);
    bySubject.set(subject, row);
  }
  const subjects = [...bySubject.values()]
    .map((r) => ({ subject: r.subject, attempts: r.attempts, average: average(r.percentages), best: Math.max(...r.percentages) }))
    .sort((a, b) => b.attempts - a.attempts || a.subject.localeCompare(b.subject));
  const avgBySubject = new Map(subjects.map((s) => [s.subject, s.average]));

  // ---- learning progress: the last 10 results in time order, and how much of what is open has been tried ------
  const openExams = exams.filter((e) => isOpen(e, now));
  const attemptedIds = new Set(sorted.map((a) => idOf(a.examId)));
  const openTried = openExams.filter((e) => attemptedIds.has(idOf(e._id ?? e.id))).length;
  const progress = {
    series: chronological.slice(-10).map((a) => ({
      id: idOf(a._id ?? a.id),
      percentage: a.percentage,
      submittedAt: a.submittedAt || null,
      examTitle: examById.get(idOf(a.examId))?.title || "Examination",
    })),
    openExaminations: openExams.length,
    openExaminationsTried: openTried,
    // null when nothing is open, so the screen does not show a meaningless 0%
    coveragePercent: openExams.length ? Math.round((openTried / openExams.length) * 100) : null,
  };

  // ---- examinations in progress that can still be resumed ---------------------------------------------------
  const continueExams = inProgress
    .filter((a) => toMs(a.deadline) > now.getTime())
    .map((a) => {
      const exam = examById.get(idOf(a.examId));
      return {
        attemptId: idOf(a._id ?? a.id),
        examId: idOf(a.examId),
        examTitle: exam?.title || "Examination",
        subject: exam?.subject || null,
        startedAt: a.startedAt || null,
        deadline: a.deadline,
        secondsLeft: Math.max(0, Math.floor((toMs(a.deadline) - now.getTime()) / 1000)),
        answered: a.answeredCount ?? null,
        questionCount: exam?.questionCount ?? null,
      };
    })
    .sort((a, b) => a.secondsLeft - b.secondsLeft);
  const runningExamIds = new Set(continueExams.map((c) => c.examId));

  // ---- recommended examinations -----------------------------------------------------------------------------
  // Open, with attempts left, not already running. Subjects where the student's average is lowest come first,
  // then examinations the student has never attempted. Every suggestion carries the reason it was chosen.
  const attemptsUsed = new Map();
  for (const a of sorted) attemptsUsed.set(idOf(a.examId), (attemptsUsed.get(idOf(a.examId)) || 0) + 1);
  const recommended = openExams
    .filter((e) => {
      const id = idOf(e._id ?? e.id);
      return !runningExamIds.has(id) && (attemptsUsed.get(id) || 0) < (e.maxAttempts ?? 1) && (e.questionCount ?? 0) > 0;
    })
    .map((e) => {
      const id = idOf(e._id ?? e.id);
      const subjAvg = avgBySubject.get(e.subject);
      const never = !attemptedIds.has(id);
      let reason, rank;
      if (subjAvg != null && subjAvg < 50) { reason = `Your ${e.subject} average is ${subjAvg}%. More practice here can help.`; rank = 0 + subjAvg / 1000; }
      else if (never && subjAvg == null) { reason = "A new subject for you."; rank = 1; }
      else if (never) { reason = "You have not attempted this examination yet."; rank = 2 + (subjAvg ?? 100) / 1000; }
      else { reason = "You can attempt this again to improve your score."; rank = 3 + (subjAvg ?? 100) / 1000; }
      return {
        id, title: e.title, subject: e.subject, level: e.level || null, examType: e.examType || null,
        durationMinutes: e.durationMinutes, questionCount: e.questionCount ?? 0,
        attemptsUsed: attemptsUsed.get(id) || 0, maxAttempts: e.maxAttempts ?? 1,
        availableUntil: e.availableUntil || null, reason, _rank: rank,
      };
    })
    .sort((a, b) => a._rank - b._rank || a.title.localeCompare(b.title))
    .slice(0, 4)
    .map(({ _rank, ...rest }) => rest);

  const recent = sorted.slice(0, 5).map((a) => attemptSummary(a, examById.get(idOf(a.examId))));

  return { stats, progress, subjects, continueExams, recommended, recent };
}

module.exports = { buildDashboard, isOpen, average };
