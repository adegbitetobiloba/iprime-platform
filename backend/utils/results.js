// Per-subject result breakdown (like a JAMB score slip): overall score, percentage and time, plus each subject.
// Pure functions. Works on the questions THIS attempt was given, so pooled exams are marked against the student's own paper.
const NO_SUBJECT = "General";
const r2 = (n) => Math.round(n * 100) / 100;

function breakdownBySubject(served, answers, examSubject) {
  const given = answers || {};
  const order = [], by = new Map();
  for (const q of served) {
    const subject = String(q.subject || examSubject || NO_SUBJECT).trim() || NO_SUBJECT;
    if (!by.has(subject)) { by.set(subject, { subject, questions: 0, total: 0, score: 0, correct: 0, incorrect: 0, unanswered: 0 }); order.push(subject); }
    const row = by.get(subject), marks = q.marks ?? 1, pick = given[String(q._id)];
    row.questions += 1; row.total += marks;
    if (!pick) row.unanswered += 1; else if (pick === q.correctKey) { row.correct += 1; row.score += marks; } else row.incorrect += 1;
  }
  const subjects = order.map((s) => { const x = by.get(s); return { ...x, total: r2(x.total), score: r2(x.score), percentage: x.total ? r2((x.score / x.total) * 100) : 0 }; });
  const total = r2(subjects.reduce((n, s) => n + s.total, 0)), score = r2(subjects.reduce((n, s) => n + s.score, 0));
  return { subjects, overall: { questions: subjects.reduce((n, s) => n + s.questions, 0), total, score, percentage: total ? r2((score / total) * 100) : 0 } };
}

module.exports = { breakdownBySubject, NO_SUBJECT };
