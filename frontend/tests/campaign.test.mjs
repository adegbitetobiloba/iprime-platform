// Run with: node --test frontend/tests/campaign.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { daysUntil, countdownText, CAMPAIGN } from "../src/campaign.js";

test("days until the start date", () => {
  assert.equal(daysUntil("2026-11-01", new Date(2026, 9, 31, 23, 59)), 1);
  assert.equal(daysUntil("2026-11-01", new Date(2026, 10, 1, 0, 1)), 0);
  assert.equal(daysUntil("2026-11-01", new Date(2026, 10, 3, 9, 0)), -2);
  assert.equal(daysUntil("2026-11-01", new Date(2026, 9, 21, 9, 0)), 11);
});
test("countdown wording", () => {
  assert.equal(countdownText(11), "Lectures start in 11 days");
  assert.equal(countdownText(1), "Lectures start tomorrow");
  assert.equal(countdownText(0), "Lectures start today");
  assert.equal(countdownText(-5), "Lectures have begun");
});
test("flyer facts are present and the bank details are not in the data", () => {
  assert.equal(CAMPAIGN.subjectGroups.length, 3);
  assert.equal(CAMPAIGN.reasons.length, 5);
  assert.ok(!JSON.stringify(CAMPAIGN).includes("9097750150 "));
  assert.ok(!/moniepoint|okoye/i.test(JSON.stringify(CAMPAIGN)));
});
