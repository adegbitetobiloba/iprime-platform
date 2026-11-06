// Run with: node --test frontend/tests/achievements.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { isPublishable, publishableAchievements, STARTER_SET, PORTRAIT_FILES, fromApi, hiddenReason } from "../src/achievements.js";

const ok = { id: "t1", score: 300, verified: true, consent: "granted" };

test("the starter set is the four scholars from the flyer, all with the owner's confirmation", () => {
  assert.deepEqual(STARTER_SET.map((a) => a.score).sort((x, y) => x - y), [342, 344, 355, 362]);
  assert.equal(publishableAchievements(STARTER_SET).length, 4);
  assert.ok(STARTER_SET.every((a) => a.label === "JAMB score" && a.examType === "UTME"));   // 355 is a real JAMB score (owner, 3 Nov 2026)
});
test("every starter photo is one the admin can choose, under /images/achievers/", () => {
  const known = new Set(PORTRAIT_FILES.map((p) => p.path));
  assert.ok(STARTER_SET.every((a) => known.has(a.portrait.src) && a.portrait.src.startsWith("/images/achievers/")));
});
test("a name and a year are optional", () => assert.equal(isPublishable({ ...ok }), true));
test("verification and consent are required", () => {
  assert.equal(isPublishable({ ...ok, verified: false }), false);
  assert.equal(isPublishable({ ...ok, consent: "pending" }), false);
  assert.equal(isPublishable({ ...ok, consent: "withdrawn" }), false);
});
test("minors need guardian consent", () => {
  assert.equal(isPublishable({ ...ok, isMinor: true }), false);
  assert.equal(isPublishable({ ...ok, isMinor: true, guardianConsent: true }), true);
});
test("bad scores are rejected", () => {
  for (const score of [0, -1, "355", NaN, undefined]) assert.equal(isPublishable({ ...ok, score }), false);
  assert.equal(isPublishable(null), false);
});
test("server records become cards with the photo only when the server sent one", () => {
  assert.equal(fromApi({ id: "x", score: 342, portrait: null }).imageConsent, false);
  const c = fromApi({ id: "x", score: 342, portrait: { src: "/images/achievers/scholar-342.jpg", alt: "a" } });
  assert.equal(c.imageConsent, true);
  assert.equal(isPublishable(c), true);
});
test("the admin screen explains why a record is hidden", () => {
  const full = { published: true, verified: true, consent: "granted", score: 300 };
  assert.equal(hiddenReason(full), null);
  assert.equal(hiddenReason({ ...full, published: false }), "Not switched on");
  assert.equal(hiddenReason({ ...full, archived: true }), "Archived");
  assert.equal(hiddenReason({ ...full, consent: "pending" }), "Consent pending");
  assert.equal(hiddenReason({ ...full, consent: "withdrawn" }), "Consent withdrawn");
  assert.equal(hiddenReason({ ...full, verified: false }), "Not verified");
  assert.equal(hiddenReason({ ...full, isMinor: true }), "Guardian consent needed");
});
