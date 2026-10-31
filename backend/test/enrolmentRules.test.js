const { test } = require("node:test");
const assert = require("node:assert/strict");
const r = require("../utils/enrolmentRules");

test("a draft can be submitted but cannot jump to approved", () => {
  assert.equal(r.canTransition("draft", "submitted"), true);
  assert.equal(r.canTransition("draft", "approved"), false);
});
test("approved and rejected are final", () => {
  for (const to of r.ENROLMENT_STATUSES) { assert.equal(r.canTransition("approved", to), false); assert.equal(r.canTransition("rejected", to), false); }
});
test("more_info_required returns to submitted, nothing else", () => {
  assert.equal(r.canTransition("more_info_required", "submitted"), true);
  assert.equal(r.canTransition("more_info_required", "approved"), false);
});
test("unknown statuses are refused", () => { assert.equal(r.canTransition("nope", "submitted"), false); assert.equal(r.canTransition("draft", "nope"), false); });

test("age is computed from date of birth, including the birthday edge", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(r.calculateAge("2008-10-30", now), 18);
  assert.equal(r.calculateAge("2008-10-31", now), 17);
  assert.equal(r.calculateAge("2026-11-01", now), null); // future
  assert.equal(r.calculateAge("garbage", now), null);
});
test("guardian consent is required under 18 and when the age is unknown", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(r.requiresGuardianConsent("2010-01-01", now), true);
  assert.equal(r.requiresGuardianConsent("2000-01-01", now), false);
  assert.equal(r.requiresGuardianConsent(undefined, now), true);
});

test("money converts to integer kobo without floating point error", () => {
  assert.equal(r.toMinorUnits("18000"), 1800000);
  assert.equal(r.toMinorUnits("18,000.50"), 1800050);
  assert.equal(r.toMinorUnits("0.1"), 10);
  assert.equal(r.toMinorUnits("19.99"), 1999);
  for (const bad of ["-5", "1.234", "abc", "", null, undefined, "1e3"]) assert.equal(r.toMinorUnits(bad), null);
});

const approved = { status: "approved" };
const invoice = { approvedFeeMinor: 1800000, currency: "NGN" };
const pay = (over) => ({ status: "verified", currency: "NGN", amountMinor: 1800000, ...over });
test("approved + fully paid is eligible", () => {
  const x = r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay()] });
  assert.equal(x.eligible, true); assert.equal(x.overpaidMinor, 0);
});
test("two verified part payments that add up to the fee are eligible", () => {
  const x = r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay({ amountMinor: 1000000 }), pay({ amountMinor: 800000 })] });
  assert.equal(x.eligible, true);
});
test("payment alone does not activate: the enrolment must be approved", () => {
  for (const status of ["draft", "submitted", "under_review", "more_info_required", "rejected"])
    assert.equal(r.isEligibleForActivation({ enrolment: { status }, invoice, payments: [pay()] }).eligible, false);
});
test("approval alone does not activate: payment must be verified in full", () => {
  assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice, payments: [] }).eligible, false);
  assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay({ amountMinor: 1799999 })] }).eligible, false);
});
test("pending, failed, reversed and wrong-currency payments never count", () => {
  for (const over of [{ status: "pending" }, { status: "failed" }, { status: "reversed" }, { currency: "USD" }])
    assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay(over)] }).eligible, false);
});
test("a missing or zero approved fee is never eligible", () => {
  assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice: { approvedFeeMinor: 0, currency: "NGN" }, payments: [pay()] }).eligible, false);
  assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice: null, payments: [pay()] }).eligible, false);
});
test("overpayment is reported, not hidden", () => {
  const x = r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay({ amountMinor: 2000000 })] });
  assert.equal(x.eligible, true); assert.equal(x.overpaidMinor, 200000);
});
test("an unsupported policy fails closed", () => {
  assert.equal(r.isEligibleForActivation({ enrolment: approved, invoice, payments: [pay()], policy: "deposit" }).eligible, false);
});
test("references are unique-looking and use the expected shape", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const ref = r.generateReference(); assert.match(ref, /^PET-ENR-[2-9A-HJ-NP-Z]{8}$/); seen.add(ref); }
  assert.equal(seen.size, 500);
});
