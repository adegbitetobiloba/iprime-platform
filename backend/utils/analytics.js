// Performance analytics (workstream 2). Pure functions: no database, no Express, so every formula is testable.
// Formulas are documented in docs/ANALYTICS.md. Rules that hold everywhere in this file:
//  - Only SUBMITTED attempts count. Absent students have no attempts and are never given a zero here.
//  - Grading is NOT re-invented: scoreAttempt() from utils/cbt.js is the one grading formula.
//    The stored score on the attempt stays canonical for scores and trends. Question-level analysis
//    (topics, missed questions) is only used for an attempt whose re-grade matches the stored result;
//    if the exam was edited after the attempt, that attempt is reported as "unverifiable" instead of guessed.
//  - Correct answers are never returned. A student sees which questions they missed, not the key.
const { scoreAttempt, toPlain } = require("./cbt");
const { servedQuestions } = require("./randomise"); // the exam system's own rule for "the questions THIS attempt was given"

const round1 = (n) => Math.round(n * 10) / 10;
const idOf = (v) => (v == null ? "" : String(v));
const toMs = (v) => (v ? new Date(v).getTime() : NaN);

// Documented thresholds. A topic needs this many answered-or-skipped questions before it is labelled at all.
const MIN_EVIDENCE = 5;
const STRONG_AT = 70;
const ATTENTION_BELOW = 50;
const UNTAGGED = "Untagged";
const UNSPECIFIED = "Subject not set";

// Time actually spent: start to submit, minus any time an administrator had the clock paused (ExamControl records it in pausedTotalSeconds).
// Without this a paused student would look slow. Never negative; null when start or submit time is missing.
function activeSeconds(a) {
  if (!a.startedAt || !a.submittedAt) return null;
  const wall = Math.round((toMs(a.submittedAt) - toMs(a.startedAt)) / 1000);
  return Math.max(0, wall - Math.max(0, Number(a.pausedTotalSeconds) || 0));
}

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
      timeUsedSeconds: activeSeconds(a),
    };
  });

  // ---- 2. question-level facts, only from attempts that re-grade to the stored result --------------------------
  const subjects = new Map(); // subject -> { earned, available, questions, attemptIds:Set }
  const perAttempt = new Map(); // attemptId -> Map(subject -> { earned, available })
  const topics = new Map();   // topic -> { earned, available, questions, attemptIds:Set }
  const missed = new Map();   // "examId:questionId" -> { ..., missedIn:[attemptId], seenIn:n }
  const verifiedAttemptIds = [];
  const unverifiable = [];

  for (const a of submitted) {
    const exam = examById.get(idOf(a.examId));
    const attemptId = idOf(a._id ?? a.id);
    const questions = servedQuestions(exam, a); // a pooled attempt is graded on its own draw, not on the whole pool
    const regraded = questions.length ? scoreAttempt(questions, a.answers) : null;
    const same = regraded
      && regraded.score === a.score && regraded.totalMarks === a.totalMarks
      && regraded.correct === a.correct && regraded.incorrect === a.incorrect && regraded.unanswered === a.unanswered;
    if (!same) { unverifiable.push({ attemptId, examId: idOf(a.examId), reason: exam ? "The examination changed after this attempt." : "The examination no longer exists." }); continue; }
    verifiedAttemptIds.push(attemptId);

    const given = toPlain(a.answers);
    const mine = new Map();
    perAttempt.set(attemptId, mine);
    for (const q of questions) {
      const qid = idOf(q._id);
      const marks = q.marks ?? 1;
      const choice = given[qid];
      const isRight = Boolean(choice) && choice === q.correctKey;

      const topic = q.topic?.trim() || UNTAGGED;
      const t = topics.get(topic) || { topic, earned: 0, available: 0, questions: 0, attemptIds: new Set() };
      t.earned += isRight ? marks : 0; t.available += marks; t.questions += 1; t.attemptIds.add(attemptId);
      topics.set(topic, t);

      const subject = (q.subject || exam.subject || "").trim() || UNSPECIFIED;
      const sg = subjects.get(subject) || { subject, earned: 0, available: 0, questions: 0, attemptIds: new Set() };
      sg.earned += isRight ? marks : 0; sg.available += marks; sg.questions += 1; sg.attemptIds.add(attemptId);
      subjects.set(subject, sg);
      const pa = mine.get(subject) || { earned: 0, available: 0 };
      pa.earned += isRight ? marks : 0; pa.available += marks;
      mine.set(subject, pa);

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

  // Subject level: same rule as topics (a subject is only described once it has MIN_EVIDENCE questions of evidence).
  const subjectRows = [...subjects.values()]
    .map((g) => { const percentage = g.available ? round1((g.earned / g.available) * 100) : 0; return { subject: g.subject, percentage, questions: g.questions, attempts: g.attemptIds.size, band: topicBand(percentage, g.questions) }; })
    .sort((a, b) => a.percentage - b.percentage || a.subject.localeCompare(b.subject));
  // Per attempt: how each subject went inside that one attempt (only for attempts that re-graded cleanly, otherwise null).
  for (const h of history) {
    const m = perAttempt.get(h.attemptId);
    h.subjectBreakdown = m ? [...m.entries()].map(([subject, v]) => ({ subject, earned: v.earned, available: v.available, percentage: v.available ? round1((v.earned / v.available) * 100) : 0 })).sort((a, b) => a.subject.localeCompare(b.subject)) : null;
  }

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
    subjects: subjectRows,
    untaggedQuestions: topics.get(UNTAGGED)?.questions || 0,
    recurringMisses,
    retests,
    focus,
    unverifiable,
  };
}

module.exports = { buildStudentAnalytics, UNSPECIFIED, activeSeconds, topicBand, MIN_EVIDENCE, STRONG_AT, ATTENTION_BELOW, UNTAGGED };
