// Rows for the examination results CSV. Uses rankFirstAttempts() so the export and the on-screen analytics always
// agree: first submitted attempt per student, tied scores share a rank, timed-out attempts are marked.
// Deliberately NOT included: email, phone, guardian, medical, address, payment details, answers or keys.
const { rankFirstAttempts } = require("./cohortAnalytics");
const { toCsv } = require("./csv");

const iso = (v) => (v ? new Date(v).toISOString() : "");

function buildResultRows({ attempts = [], users = [] }) {
  const { firsts, countByStudent, ranking } = rankFirstAttempts(attempts);
  const byAttempt = new Map(firsts.map((a) => [String(a._id ?? a.id), a]));
  const byUser = new Map(users.map((u) => [String(u._id ?? u.id), u]));
  return ranking.map((r) => {
    const a = byAttempt.get(r.attemptId);
    const u = byUser.get(r.userId);
    return {
      rank: r.rank,
      studentId: u?.studentId || "",
      name: u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "Former student",
      percentage: r.percentage,
      score: a.score ?? 0, totalMarks: a.totalMarks ?? 0,
      correct: a.correct ?? 0, incorrect: a.incorrect ?? 0, skipped: a.unanswered ?? 0,
      submittedAt: iso(a.submittedAt),
      timedOut: Boolean(a.autoSubmitted),
      attemptsAtThisExam: countByStudent.get(r.userId) || 1,
    };
  });
}

const COLUMNS = [
  { header: "Rank", value: (r) => r.rank },
  { header: "Student ID", value: (r) => r.studentId },
  { header: "Name", value: (r) => r.name },
  { header: "Score (%)", value: (r) => r.percentage },
  { header: "Marks", value: (r) => r.score },
  { header: "Total marks", value: (r) => r.totalMarks },
  { header: "Correct", value: (r) => r.correct },
  { header: "Incorrect", value: (r) => r.incorrect },
  { header: "Skipped", value: (r) => r.skipped },
  { header: "Submitted at (UTC)", value: (r) => r.submittedAt },
  { header: "Timed out", value: (r) => r.timedOut },
  { header: "Attempts at this exam", value: (r) => r.attemptsAtThisExam },
];

const resultsCsv = (input) => toCsv(buildResultRows(input), COLUMNS);

module.exports = { buildResultRows, resultsCsv, COLUMNS };
