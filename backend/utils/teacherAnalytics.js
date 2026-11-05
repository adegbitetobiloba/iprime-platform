// Pure helpers for what a TEACHER may see of a student's performance. No database access here, so they are easy to test.
//
// Rules (docs/ANALYTICS_TEACHER.md):
//  - Only students with an ACTIVE assignment to the teacher (enforced by the controller, not here).
//  - If the assignment names subjects, only attempts of examinations in those subjects are used.
//  - Wording describes the work, never the person: "needs practice" / "worth a check-in", not "weak student".
const { buildStudentAnalytics } = require("./analytics");
const { SUPPORT_BELOW } = require("./cohortAnalytics");

const IMPROVING_BY = 5;     // percentage points the latest result is above the earlier average
const MIN_FOR_TREND = 3;    // latest + at least two earlier attempts
const norm = (s) => String(s || "").trim().toLowerCase();
const round1 = (n) => Math.round(n * 10) / 10;

// subjects empty/undefined means "no restriction". Attempts of examinations with no subject are not shown when a restriction exists.
function restrictToSubjects({ attempts = [], exams = [], subjects }) {
  const wanted = new Set((subjects || []).map(norm).filter(Boolean));
  if (wanted.size === 0) return { attempts, exams, restricted: false };
  const allowed = new Set(exams.filter((e) => wanted.has(norm(e.subject))).map((e) => String(e._id ?? e.id)));
  return { attempts: attempts.filter((a) => allowed.has(String(a.examId))), exams: exams.filter((e) => allowed.has(String(e._id ?? e.id))), restricted: true };
}

// Compact row for the teacher's student list, derived from the same analytics the student sees.
function summarise(analytics) {
  const h = analytics.history;
  const n = h.length;
  const latest = n ? h[n - 1] : null;
  const average = n ? round1(h.reduce((s, x) => s + (x.percentage || 0), 0) / n) : null;
  let trend = "not_enough_data", change = null;
  if (n >= MIN_FOR_TREND) {
    const earlier = h.slice(0, -1);
    const prevAvg = earlier.reduce((s, x) => s + (x.percentage || 0), 0) / earlier.length;
    change = round1(latest.percentage - prevAvg);
    trend = change >= IMPROVING_BY ? "improving" : change <= -IMPROVING_BY ? "declining" : "steady";
  }
  const needsPractice = analytics.topics.filter((t) => t.band === "needs_practice").sort((a, b) => a.percentage - b.percentage);
  return {
    attempts: n,
    averagePercentage: average,
    latest: latest ? { examTitle: latest.examTitle, subject: latest.subject, percentage: latest.percentage, submittedAt: latest.submittedAt } : null,
    trend, change,
    topicsNeedingPractice: needsPractice.slice(0, 3).map((t) => ({ topic: t.topic, percentage: t.percentage })),
    // Plain rule, shown with its reason: the latest result is under the check-in line.
    checkIn: latest ? latest.percentage < SUPPORT_BELOW : false,
  };
}

function studentView({ attempts, exams, subjects }) {
  const r = restrictToSubjects({ attempts, exams, subjects });
  const analytics = buildStudentAnalytics({ attempts: r.attempts, exams: r.exams });
  return { restricted: r.restricted, analytics, summary: summarise(analytics) };
}

module.exports = { restrictToSubjects, summarise, studentView, IMPROVING_BY, MIN_FOR_TREND };
