const { test } = require("node:test");
const assert = require("node:assert/strict");
const r = require("../utils/accessRules");
const f = require("../utils/messageFiles");
const hub = require("../utils/messageHub");
const { EventEmitter } = require("node:events");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);
const PDF = Buffer.from("%PDF-1.4\n" + "x".repeat(200) + "\n%%EOF\n");

test("payment status: awaiting until a payment is recorded; voided payments do not count", () => {
  assert.equal(r.paymentStatus(null), "awaiting");
  assert.equal(r.paymentStatus({ payments: [] }), "awaiting");
  assert.equal(r.paymentStatus({ payments: [{ amountMinor: 100, voidedAt: new Date() }] }), "awaiting");
  const a = { payments: [{ amountMinor: 500000 }, { amountMinor: 250000, voidedAt: new Date() }] };
  assert.equal(r.paymentStatus(a), "confirmed");
  assert.equal(r.totalConfirmedMinor(a), 500000);
});
test("the student form opens only on an explicit true", () => {
  for (const a of [null, {}, { features: {} }, { features: { enrolmentForm: false } }, { features: { enrolmentForm: "true" } }]) assert.equal(r.formUnlocked(a), false);
  assert.equal(r.formUnlocked({ features: { enrolmentForm: true } }), true);
});
test("the Nigerian day and session follow West Africa Time (UTC+1)", () => {
  assert.equal(r.lagosDay(new Date("2026-11-02T23:30:00Z")), "2026-11-03"); // 00:30 the next day in Lagos
  assert.equal(r.lagosDay(new Date("2026-11-02T10:00:00Z")), "2026-11-02");
  assert.equal(r.sessionFor(new Date("2026-11-02T10:59:00Z")), "morning");   // 11:59
  assert.equal(r.sessionFor(new Date("2026-11-02T11:00:00Z")), "afternoon"); // 12:00
  assert.equal(r.sessionFor(new Date("2026-11-02T16:00:00Z")), "evening");   // 17:00
});
test("check-in eligibility needs an approved account AND verified identity", () => {
  const ok = r.checkInEligibility({ approval: "approved" }, { verification: { status: "verified" } });
  assert.deepEqual(ok, { eligible: true, reasons: [] });
  assert.equal(r.checkInEligibility({}, { verification: { status: "verified" } }).eligible, true); // older accounts have no approval value and count as approved
  assert.equal(r.checkInEligibility({ approval: "pending" }, { verification: { status: "verified" } }).eligible, false);
  const un = r.checkInEligibility({ approval: "approved" }, null);
  assert.equal(un.eligible, false); assert.match(un.reasons[0], /verified/);
  assert.equal(r.checkInEligibility({ approval: "approved" }, { verification: { status: "revoked" } }).eligible, false);
});
test("verification needs the document seen; under-18s also need a guardian contacted; removal needs a reason", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  const adult = { dob: new Date("2000-01-01") }, minor = { dob: new Date("2012-01-01") };
  assert.ok(r.verificationProblem(adult, { action: "verify" }, now));
  assert.equal(r.verificationProblem(adult, { action: "verify", identityDocumentSeen: true }, now), null);
  assert.ok(r.verificationProblem(minor, { action: "verify", identityDocumentSeen: true }, now));
  assert.equal(r.verificationProblem(minor, { action: "verify", identityDocumentSeen: true, guardianContacted: true }, now), null);
  assert.ok(r.verificationProblem(adult, { action: "revoke", note: "no" }, now));
  assert.equal(r.verificationProblem(adult, { action: "revoke", note: "Documents were forged" }, now), null);
});
test("deleting needs the typed student ID (students) or email (others), case-insensitively", () => {
  assert.equal(r.confirmMatches({ role: "student", studentId: "PET-AB12", email: "a@b.com" }, " pet-ab12 "), true);
  assert.equal(r.confirmMatches({ role: "student", studentId: "PET-AB12", email: "a@b.com" }, "a@b.com"), false);
  assert.equal(r.confirmMatches({ role: "parent", email: "p@x.com" }, "P@X.com"), true);
  assert.equal(r.confirmMatches({ role: "parent", email: "p@x.com" }, ""), false);
  assert.equal(r.confirmMatches(null, "x"), false);
  assert.equal(r.isDeleted({ email: "deleted-1@deleted.invalid" }), true);
  assert.equal(r.isDeleted({ email: "a@b.com" }), false);
});

test("attachments: real PNG, JPEG and PDF pass; mismatches, oversize and disguised files fail", () => {
  assert.equal(f.checkUpload(PNG, "image/png"), null);
  assert.equal(f.checkUpload(JPG, "image/jpeg"), null);
  assert.equal(f.checkUpload(PDF, "application/pdf"), null);
  assert.equal(f.checkUpload(PNG, "image/jpeg"), "That file's type does not match its contents.");
  assert.ok(f.checkUpload(Buffer.from("<script>alert(1)</script>".padEnd(50)), "image/png"));          // a script renamed to .png
  assert.ok(f.checkUpload(Buffer.alloc(f.MAX_BYTES + 1, 1), "image/png"));
  assert.ok(f.checkUpload(Buffer.alloc(0), "image/png"));
  assert.ok(f.checkUpload(Buffer.from("%PDF-1.4\n" + "x".repeat(5000)), "application/pdf"));            // truncated PDF
});
test("attachment names are cleaned: no paths, no control characters, never empty", () => {
  assert.equal(f.safeName("..\\..\\evil\u0000.png", "image/png"), "evil.png");
  assert.equal(f.safeName("", "application/pdf"), "attachment.pdf");
  assert.equal(f.safeName("a".repeat(300), "image/png").length, 100);
});

test("live hub: publishes to subscribers of a key only, stops after unsubscribe, caps tabs per student", () => {
  const mk = () => ({ got: [], write(x) { this.got.push(x); }, end() { this.ended = true; } });
  const a = mk(), b = mk();
  const offA = hub.subscribe("student:1", a); hub.subscribe("student:2", b);
  hub.publish("student:1", { type: "message", n: 1 });
  assert.equal(a.got.length, 1); assert.equal(b.got.length, 0);
  assert.match(a.got[0], /^data: \{"type":"message","n":1\}\n\n$/);
  offA(); hub.publish("student:1", { n: 2 }); assert.equal(a.got.length, 1);
  const tabs = Array.from({ length: hub.MAX_PER_KEY + 1 }, mk);
  tabs.forEach((t) => hub.subscribe("student:9", t));
  assert.equal(hub.count("student:9"), hub.MAX_PER_KEY);
  assert.equal(tabs[0].ended, true);
});
test("live hub: open() sends stream headers, a heartbeat, and cleans up on close", async () => {
  const req = new EventEmitter(); const sent = []; const headers = {};
  const res = { status() { return this; }, set(h) { Object.assign(headers, h); }, flushHeaders() { headers.flushed = true; }, write(x) { sent.push(x); } };
  hub.open(req, res, "admins", 10);
  assert.equal(headers["Content-Type"], "text/event-stream"); assert.equal(headers["X-Accel-Buffering"], "no"); assert.equal(headers.flushed, true);
  assert.equal(hub.count("admins"), 1);
  await new Promise((ok) => setTimeout(ok, 35));
  assert.ok(sent.some((x) => x.includes(": ping")));
  req.emit("close");
  assert.equal(hub.count("admins"), 0);
});
