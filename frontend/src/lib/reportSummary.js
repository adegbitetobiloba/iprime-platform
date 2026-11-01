// Turns the analytics response into the plain facts and sentences used by the printable progress report.
// Pure and dependency-free so it can be tested. Wording rules: respectful, specific, never a rank or a comparison
// with other students, never a label for the learner. Every sentence is produced by a visible rule below; nothing
// is invented, and when there is too little data the report says so.

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export const MIN_ATTEMPTS_FOR_TREND = 3;

export function summarise(analytics) {
  const history = analytics?.history || [];
  const topics = (analytics?.topics || []).filter((t) => t.topic !== "Untagged");
  const retests = analytics?.retests || [];
  const pcts = history.map((h) => h.percentage);
  const latest = history.length ? history[history.length - 1] : null;
  const earlier = pcts.slice(0, -1);
  const earlierAvg = avg(earlier);

  const bySubject = new Map();
  for (const h of history) {
    if (!h.subject) continue;
    const row = bySubject.get(h.subject) || { subject: h.subject, attempts: 0, percentages: [] };
    row.attempts += 1; row.percentages.push(h.percentage); bySubject.set(h.subject, row);
  }
  const subjects = [...bySubject.values()]
    .map((r) => ({ subject: r.subject, attempts: r.attempts, average: avg(r.percentages), best: Math.max(...r.percentages) }))
    .sort((a, b) => b.attempts - a.attempts || a.subject.localeCompare(b.subject));

  const stats = {
    attempts: history.length,
    examsTaken: new Set(history.map((h) => h.examId)).size,
    average: avg(pcts),
    best: pcts.length ? Math.max(...pcts) : null,
    latest: latest ? latest.percentage : null,
    changeFromEarlier: latest && earlierAvg !== null ? round1(latest.percentage - earlierAvg) : null,
  };

  const strengths = topics.filter((t) => t.band === "strong").sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  const nextSteps = topics.filter((t) => t.band === "needs_practice").slice(0, 3);
  const improved = retests.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);

  // Opening sentence: one of a few rules, chosen from the data.
  let headline;
  if (!history.length) headline = "No examinations have been submitted yet, so there is nothing to report.";
  else if (history.length < MIN_ATTEMPTS_FOR_TREND) headline = `This is an early report based on ${history.length} submitted examination${history.length === 1 ? "" : "s"}. A few more will make the picture clearer.`;
  else if (stats.changeFromEarlier > 0) headline = "The most recent result is higher than the earlier average, which is encouraging progress.";
  else if (stats.changeFromEarlier < 0) headline = "The most recent result is a little below the earlier average. One result is only a snapshot, and the next steps below show where extra practice may help.";
  else headline = "Results have been steady across the submitted examinations.";

  return { stats, subjects, strengths, nextSteps, improved, headline, trend: history.slice(-12).map((h) => ({ id: h.attemptId, percentage: h.percentage })), enough: history.length >= MIN_ATTEMPTS_FOR_TREND };
}
