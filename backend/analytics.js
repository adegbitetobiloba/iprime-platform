// Performance analytics (workstream 2). Pure functions: no database, no Express, so every formula is testable.
// Formulas are documented in docs/ANALYTICS.md. Rules that hold everywhere in this file:
//  - Only SUBMITTED attempts count. Absent students have no attempts and are never given a zero here.
//  - Grading is NOT re-invented: scoreAttempt() from utils/cbt.js is the one grading formula.
//    The stored score on the attempt stays canonical for scores and trends. Question-level analysis
//    (topics, missed questions) is only used for an attempt whose re-grade matches the stored result;
//    if the exam was edited after the attempt, that attempt is reported as "unverifiable" instead of guessed.
//  - Correct answers are never returned. A student sees which questions they missed, not the key.
const { scoreAttempt, toPlain } = require("./cbt");

const round1 = (n) => Math.round(n * 10) / 10;
const idOf = (v) => (v == null ? "" : String(v));
const toMs = (v) => (v ? new Date(v).getTime() : NaN);

// Documented thresholds. A topic needs this many answered-or-skipped questions before it is labelled at all.
const MIN_EVIDENCE = 5;
const STRONG_AT = 70;
const ATTENTION_BELOW = 50;
const UNTAGGED = "Untagged";

function topicBand(percentage, evidence) {
  if (evidence < MIN_EVIDENCE) return "not_enough_evidence";
  if (percentage >= STRONG_AT) return "strong";
  if (percentage < ATTENTION_BELOW) return "needs_practice";
  return "developing";
}

// attempts: submitted attempts (plain). exams: plain exams INCLUDING questions (server side only).
function buildStudentAnalytics({ attempts = [], exams = [] }) {
  const examById = new Map(exams.map((e) => [idOf(e._id ?? e.id), e]));
  const submitted = attempts
    .filter((a) => a.status === "submitted" || a.submittedAt)
    .sort((a, b) => toMs(a.submittedAt) - toMs(b.submittedAt)); // oldest first

  // ---- 1. score history: copied from the persisted result, never recomputed ----------------------------------
  const history = submitted.map((a) => {
    const exam = examById.get(idOf(a.examId));
    return {
      attemptId: idOf(a._id ?? a.id),
      examId: idOf(a.examId),
      examTitle: exam?.title || "Examination",
      subject: exam?.subject || null,
      submittedAt: a.submittedAt || null,
      percentage: a.percentage ?? 0,
      score: a.score ?? 0,
      totalMarks: a.totalMarks ?? 0,
      correct: a.correct ?? 0,
      incorrect: a.incorrect ?? 0,
      unanswered: a.unanswered ?? 0,
      autoSubmitted: Boolean(a.autoSubmitted),
      timeUsedSeconds: a.startedAt && a.submittedAt ? Math.max(0, Math.round((toMs(a.submittedAt) - toMs(a.startedAt)) / 1000)) : null,
    };
  });

  // ---- 2. question-level facts, only from attempts that re-grade to the stored result --------------------------
  const topics = new Map();   // topic -> { earned, available, questions, attemptIds:Set }
  const missed = new Map();   // "examId:questionId" -> { ..., missedIn:[attemptId], seenIn:n }
  const verifiedAttemptIds = [];
  const unverifiable = [];

  for (const a of submitted) {
    const exam = examById.get(idOf(a.examId));
    const attemptId = idOf(a._id ?? a.id);
    const questions = exam?.questions || [];
    const regraded = questions.length ? scoreAttempt(questions, a.answers) : null;
    const same = regraded
      && regraded.score === a.score && regraded.totalMarks === a.totalMarks
      && regraded.correct === a.correct && regraded.incorrect === a.incorrect && regraded.unanswered === a.unanswered;
    if (!same) { unverifiable.push({ attemptId, examId: idOf(a.examId), reason: exam ? "The examination changed after this attempt." : "The examination no longer exists." }); continue; }
    verifiedAttemptIds.push(attemptId);

    const given = toPlain(a.answers);
    for (const q of questions) {
      const qid = idOf(q._id);
      const marks = q.marks ?? 1;
      const choice = given[qid];
      const isRight = Boolean(choice) && choice === q.correctKey;

      const topic = q.topic?.trim() || UNTAGGED;
      const t = topics.get(topic) || { topic, earned: 0, available: 0, questions: 0, attemptIds: new Set() };
      t.earned += isRight ? marks : 0; t.available += marks; t.questions += 1; t.attemptIds.add(attemptId);
      topics.set(topic, t);

      const key = `${idOf(a.examId)}:${qid}`;
      const m = missed.get(key) || { examId: idOf(a.examId), examTitle: exam.title, subject: exam.subject, questionId: qid, text: q.text, topic: q.topic?.trim() || null, seenIn: 0, missedIn: [], unansweredIn: 0 };
      m.seenIn += 1;
      if (!isRight) { m.missedIn.push(attemptId); if (!choice) m.unansweredIn += 1; }
      missed.set(key, m);
    }
  }

  const topicRows = [...topics.values()]
    .map((t) => {
      const percentage = t.available ? round1((t.earned / t.available) * 100) : 0;
      return { topic: t.topic, percentage, questions: t.questions, attempts: t.attemptIds.size, band: topicBand(percentage, t.questions) };
    })
    .sort((a, b) => a.percentage - b.percentage || a.topic.localeCompare(b.topic));
  const tagged = topicRows.filter((t) => t.topic !== UNTAGGED);

  // A question is "recurring" when the student missed it (wrong or skipped) in at least two separate attempts.
  const recurringMisses = [...missed.values()]
    .filter((m) => m.missedIn.length >= 2)
    .sort((a, b) => b.missedIn.length - a.missedIn.length || a.text.localeCompare(b.text))
    .slice(0, 20)
    .map((m) => ({ examId: m.examId, examTitle: m.examTitle, subject: m.subject, questionId: m.questionId, text: m.text, topic: m.topic, timesMissed: m.missedIn.length, timesSeen: m.seenIn, attemptIds: m.missedIn }));

  // ---- 3. retest comparison: first vs latest attempt of the same examination ----------------------------------
  const byExam = new Map();
  for (const h of history) (byExam.get(h.examId) || byExam.set(h.examId, []).get(h.examId)).push(h);
  const retests = [...byExam.values()]
    .filter((list) => list.length >= 2)
    .map((list) => {
      const first = list[0], latest = list[list.length - 1];
      return { examId: first.examId, examTitle: first.examTitle, subject: first.subject, attempts: list.length, firstPercentage: first.percentage, latestPercentage: latest.percentage, change: round1(latest.percentage - first.percentage), firstAttemptId: first.attemptId, latestAttemptId: latest.attemptId };
    })
    .sort((a, b) => b.attempts - a.attempts || a.examTitle.localeCompare(b.examTitle));

  // ---- 4. revision focus: plain rule, every line says why it was suggested -------------------------------------
  const focus = tagged
    .filter((t) => t.band === "needs_practice")
    .slice(0, 3)
    .map((t) => ({ topic: t.topic, basis: `${t.percentage}% across ${t.questions} questions in ${t.attempts} attempt${t.attempts === 1 ? "" : "s"}`, kind: "recommendation" }));

  return {
    definitions: { minEvidence: MIN_EVIDENCE, strongAt: STRONG_AT, attentionBelow: ATTENTION_BELOW },
    totals: { submittedAttempts: history.length, verifiedForQuestionAnalysis: verifiedAttemptIds.length, unverifiable: unverifiable.length },
    history,
    topics: topicRows,
    untaggedQuestions: topics.get(UNTAGGED)?.questions || 0,
    recurringMisses,
    retests,
    focus,
    unverifiable,
  };
}

module.exports = { buildStudentAnalytics, topicBand, MIN_EVIDENCE, STRONG_AT, ATTENTION_BELOW, UNTAGGED };
