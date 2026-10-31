// Run with: node --test frontend/tests/about.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { ABOUT, MISSION_APPROVED } from "../src/aboutContent.js";

test("about content is complete", () => {
  assert.equal(ABOUT.values.length, 10);
  assert.equal(ABOUT.teaching.length, 8);
  assert.equal(ABOUT.formats.length, 2);
  assert.ok(ABOUT.mission.length > 40 && ABOUT.vision.length > 40);
});
test("mission wording is flagged as unapproved until management signs off", () => assert.equal(MISSION_APPROVED, false));
test("no history, founding date or leader claims are made", () => {
  const all = JSON.stringify(ABOUT);
  assert.ok(!/founded|established in|since 19|since 20|ceo|director/i.test(all));
});
