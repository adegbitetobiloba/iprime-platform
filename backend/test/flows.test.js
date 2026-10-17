const { test } = require("node:test");
const assert = require("node:assert/strict");
const { signShortToken, verifyShortToken } = require("../utils/shortToken");
const { decideGoogleOutcome, maskEmail } = require("../utils/googleOutcome");

const SECRET = "a-test-secret-that-is-long-enough-1234567890";
const NOW = 1_800_000_000_000;

test("a short token verifies for its own purpose", () => {
  const t = signShortToken({ purpose: "google-link", uid: "u1" }, SECRET, 600, () => NOW);
  const p = verifyShortToken(t, SECRET, "google-link", () => NOW + 1000);
  assert.equal(p.uid, "u1");
});
test("a token for one purpose is refused for another", () => {
  const t = signShortToken({ purpose: "google-setup", sub: "1" }, SECRET, 600, () => NOW);
  assert.equal(verifyShortToken(t, SECRET, "google-link", () => NOW), null);
});
test("an expired token is refused", () => {
  const t = signShortToken({ purpose: "google-link" }, SECRET, 600, () => NOW);
  assert.equal(verifyShortToken(t, SECRET, "google-link", () => NOW + 601_000), null);
});
test("a token signed with another secret is refused", () => {
  const t = signShortToken({ purpose: "google-link" }, "another-secret-another-secret-another", 600, () => NOW);
  assert.equal(verifyShortToken(t, SECRET, "google-link", () => NOW), null);
});
test("a tampered token is refused", () => {
  const t = signShortToken({ purpose: "google-link", uid: "victim-not" }, SECRET, 600, () => NOW);
  const [, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ purpose: "google-link", uid: "victim", exp: NOW / 1000 + 600 })).toString("base64url");
  assert.equal(verifyShortToken(`${forged}.${sig}`, SECRET, "google-link", () => NOW), null);
});
test("garbage is refused without crashing", () => {
  for (const bad of ["", "abc", "a.b.c", null, undefined, 5, "x".repeat(5000), "....", "e30.e30"]) assert.equal(verifyShortToken(bad, SECRET, "google-link", () => NOW), null);
});

test("returning Google user signs in", () => {
  assert.equal(decideGoogleOutcome({ byGoogleId: { id: 1 }, byEmail: { id: 1 }, role: null }), "sign_in");
});
test("same email, not linked yet: ownership must be proven, never silently merged", () => {
  assert.equal(decideGoogleOutcome({ byGoogleId: null, byEmail: { id: 2 }, role: "student" }), "link_required");
  assert.equal(decideGoogleOutcome({ byGoogleId: null, byEmail: { id: 2 }, role: null }), "link_required");
});
test("same email but already linked to a DIFFERENT Google account is a conflict", () => {
  assert.equal(decideGoogleOutcome({ byGoogleId: null, byEmail: { id: 2, googleId: "other" }, role: null }), "conflict");
});
test("brand-new person: asked which account type, unless they already chose", () => {
  assert.equal(decideGoogleOutcome({ byGoogleId: null, byEmail: null, role: null }), "onboarding");
  assert.equal(decideGoogleOutcome({ byGoogleId: null, byEmail: null, role: "alumni" }), "create");
});
test("masked emails hide most of the address", () => {
  assert.equal(maskEmail("ada.obi@gmail.com"), "a*****i@gmail.com");
  assert.equal(maskEmail("jo@x.com"), "j@x.com");
  assert.equal(maskEmail("nonsense"), "your email");
});
