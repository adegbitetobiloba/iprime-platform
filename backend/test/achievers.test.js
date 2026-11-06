// Who may be public, and which fields may leave the server. Pure logic: no database needed.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPubliclyListable, toPublic } = require("../utils/achievers");

const ok = { _id: "a1", name: "Ada", examType: "UTME", year: 2026, score: 355, published: true, verified: true, consent: "granted", evidenceRef: "SLIP-1", isMinor: false };

test("a published, verified, consented record is listable", () => assert.equal(isPubliclyListable(ok), true));
test("every condition is required", () => {
  for (const patch of [{ published: false }, { archived: true }, { verified: false }, { consent: "pending" }, { consent: "withdrawn" }, { score: 0 }, { score: NaN }, { score: "355" }]) {
    assert.equal(isPubliclyListable({ ...ok, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(isPubliclyListable(null), false);
});
test("a minor needs guardian consent", () => {
  assert.equal(isPubliclyListable({ ...ok, isMinor: true }), false);
  assert.equal(isPubliclyListable({ ...ok, isMinor: true, guardianConsent: true }), true);
});
test("a name is optional", () => assert.equal(isPubliclyListable({ ...ok, name: "" }), true));
test("the public shape never contains private fields", () => {
  const p = toPublic({ ...ok, guardianConsent: true, imageConsent: true, portraitPath: "/images/achievers/x.jpg", testimonial: "t", testimonialApproved: true });
  for (const k of ["evidenceRef", "consent", "verified", "isMinor", "guardianConsent", "imageConsent", "published", "archived", "_id"]) assert.ok(!(k in p), k);
  assert.equal(p.id, "a1");
  assert.ok(!JSON.stringify(p).includes("SLIP-1"));
});
test("the photo needs image consent and a file", () => {
  assert.equal(toPublic({ ...ok, portraitPath: "/images/achievers/x.jpg" }).portrait, null);
  assert.equal(toPublic({ ...ok, imageConsent: true }).portrait, null);
  const p = toPublic({ ...ok, imageConsent: true, portraitPath: "/images/achievers/x.jpg" });
  assert.equal(p.portrait.src, "/images/achievers/x.jpg");
  assert.match(p.portrait.alt, /Prime Excelerate scholar|Ada/);
});
test("a testimonial shows only when approved", () => {
  assert.equal(toPublic({ ...ok, testimonial: "Great", testimonialApproved: false }).testimonial, "");
  assert.equal(toPublic({ ...ok, testimonial: "Great", testimonialApproved: true }).testimonial, "Great");
});
test("a missing name falls back to a neutral description in the alt text", () => {
  const p = toPublic({ ...ok, name: "", imageConsent: true, portraitPath: "/images/achievers/x.jpg" });
  assert.equal(p.name, "");
  assert.match(p.portrait.alt, /Prime Excelerate scholar/);
});
