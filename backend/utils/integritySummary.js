// Roll-up of one examination's integrity rows (the rows built in adminIntegrityController) for the analytics page.
// Pure: no database. Counts every attempt, including retakes, because integrity is about each sitting.
function summarise(rows) {
  const out = {
    attempts: rows.length,
    submitted: 0,
    withWarnings: 0,
    totalWarnings: 0,
    autoSubmittedByWarnings: 0,
    lateSynced: 0,
    avgAwaySeconds: 0,
    distribution: { none: 0, one: 0, two: 0, threePlus: 0 },
    needsReview: [],
  };
  let away = 0;
  for (const a of rows) {
    if (a.status === "submitted") out.submitted++;
    const v = a.violations || 0;
    out.totalWarnings += v;
    if (v > 0) out.withWarnings++;
    if (v === 0) out.distribution.none++; else if (v === 1) out.distribution.one++; else if (v === 2) out.distribution.two++; else out.distribution.threePlus++;
    if (a.submitReason === "violation_limit") out.autoSubmittedByWarnings++;
    if (a.lateSynced) out.lateSynced++;
    away += a.awaySeconds || 0;
    const reasons = [];
    if (a.submitReason === "violation_limit") reasons.push("Submitted automatically after reaching the warning limit");
    else if (v > 0) reasons.push(`${v} warning${v === 1 ? "" : "s"}`);
    if (a.lateSynced) reasons.push("Answers sent after reconnecting");
    if (reasons.length) out.needsReview.push({ id: a.id, student: a.student, studentId: a.studentId, violations: v, maxViolations: a.maxViolations, awaySeconds: a.awaySeconds || 0, percentage: a.percentage ?? null, reasons });
  }
  out.avgAwaySeconds = rows.length ? Math.round(away / rows.length) : 0;
  // Most serious first: warning-limit submissions, then most warnings, then most time away.
  out.needsReview.sort((x, y) => (y.reasons[0].startsWith("Submitted") - x.reasons[0].startsWith("Submitted")) || y.violations - x.violations || y.awaySeconds - x.awaySeconds);
  out.needsReview = out.needsReview.slice(0, 10);
  return out;
}

module.exports = { summarise };
