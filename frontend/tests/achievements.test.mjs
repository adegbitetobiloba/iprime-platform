// Run with: node --test frontend/tests/achievements.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { isPublishable, publishableAchievements, ACHIEVEMENTS } from "../src/achievements.js";

const ok = { id: "t1", name: "Test Person", examType: "UTME", year: 2026, score: 300, verified: true, evidenceRef: "REF-TEST", consent: "granted" };

test("the shipped register is empty (no unverified claims)", () => assert.equal(ACHIEVEMENTS.length, 0));
test("a complete, verified, consented record is publishable", () => assert.equal(isPublishable(ok), true));
test("missing verification blocks publication", () => assert.equal(isPublishable({ ...ok, verified: false }), false));
test("missing or pending consent blocks publication", () => {
  assert.equal(isPublishable({ ...ok, consent: undefined }), false);
  assert.equal(isPublishable({ ...ok, consent: "pending" }), false);
});
test("missing evidence reference blocks publication", () => assert.equal(isPublishable({ ...ok, evidenceRef: " " }), false));
test("minors need guardian consent", () => {
  assert.equal(isPublishable({ ...ok, isMinor: true }), false);
  assert.equal(isPublishable({ ...ok, isMinor: true, guardianConsent: true }), true);
});
test("bad year or score blocks publication", () => {
  assert.equal(isPublishable({ ...ok, year: "2026" }), false);
  assert.equal(isPublishable({ ...ok, score: "355" }), false);
  assert.equal(isPublishable({ ...ok, score: 0 }), false);
});
test("non-objects are rejected", () => { assert.equal(isPublishable(null), false); assert.equal(isPublishable("x"), false); });
test("publishableAchievements filters a list", () => assert.deepEqual(publishableAchievements([ok, { ...ok, id: "t2", verified: false }]).map((a) => a.id), ["t1"]));
