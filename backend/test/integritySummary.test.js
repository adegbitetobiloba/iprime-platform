const { test } = require("node:test");
const assert = require("node:assert/strict");
const { summarise } = require("../utils/integritySummary");

const row = (over = {}) => ({ id: "a" + Math.random(), student: "S", studentId: "", status: "submitted", submitReason: "student", violations: 0, maxViolations: 3, lateSynced: false, awaySeconds: 0, percentage: 50, ...over });

test("an empty exam gives zeros, not errors", () => {
  const s = summarise([]);
  assert.equal(s.attempts, 0);
  assert.equal(s.avgAwaySeconds, 0);
  assert.deepEqual(s.needsReview, []);
});

test("counts sittings, warnings, warning-limit submissions and late-sent answers", () => {
  const s = summarise([
    row(),
    row({ violations: 1, awaySeconds: 20 }),
    row({ violations: 2, awaySeconds: 40 }),
    row({ violations: 3, submitReason: "violation_limit", awaySeconds: 90 }),
    row({ lateSynced: true, status: "submitted" }),
    row({ status: "in_progress", submitReason: null }),
  ]);
  assert.equal(s.attempts, 6);
  assert.equal(s.submitted, 5);
  assert.equal(s.withWarnings, 3);
  assert.equal(s.totalWarnings, 6);
  assert.equal(s.autoSubmittedByWarnings, 1);
  assert.equal(s.lateSynced, 1);
  assert.deepEqual(s.distribution, { none: 3, one: 1, two: 1, threePlus: 1 });
  assert.equal(s.avgAwaySeconds, Math.round(150 / 6));
});

test("needs-review lists only flagged sittings, most serious first, capped at 10", () => {
  const rows = [row(), row({ violations: 1, student: "one" }), row({ violations: 2, student: "two" }), row({ violations: 3, submitReason: "violation_limit", student: "limit" }), row({ lateSynced: true, student: "late" })];
  const s = summarise(rows);
  assert.deepEqual(s.needsReview.map((r) => r.student), ["limit", "two", "one", "late"]);
  assert.match(s.needsReview[0].reasons[0], /warning limit/);
  const many = summarise(Array.from({ length: 30 }, (_, i) => row({ violations: 1, student: "s" + i })));
  assert.equal(many.needsReview.length, 10);
});

test("a student with no warnings and nothing late is never listed", () => {
  assert.deepEqual(summarise([row(), row()]).needsReview, []);
});
