// Pure rules for enrolment, fees and activation. No database, no network, so they are easy to test.
// Money is always integer minor units (kobo). Never floats.
const crypto = require("crypto");

const ENROLMENT_STATUSES = ["draft", "submitted", "under_review", "more_info_required", "approved", "rejected"];

// Allowed moves. Anything not listed is refused. Rejected and approved are final unless an admin reopens (not allowed here).
const TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["under_review", "more_info_required", "approved", "rejected"],
  under_review: ["more_info_required", "approved", "rejected"],
  more_info_required: ["submitted"], // the student corrects and resubmits
  approved: [],
  rejected: [],
};

function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

// Age in whole years on `now`, from the date of birth (the authoritative field). Returns null for an invalid or future date.
function calculateAge(dob, now = new Date()) {
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime()) || d > now) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

// Guardian consent is required under 18 (owner must confirm this rule; keep it a setting).
function requiresGuardianConsent(dob, now = new Date(), adultAge = 18) {
  const age = calculateAge(dob, now);
  return age === null ? true : age < adultAge; // unknown age: ask for consent rather than assume adult
}

// "18000", "18,000.50", 18000 -> integer kobo. Rejects negatives, more than 2 decimals, and non-numbers.
function toMinorUnits(input) {
  const s = String(input ?? "").trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

// Sum of verified payments in the invoice currency only. Reversed, failed, pending and other currencies never count.
function verifiedTotalMinor(payments, currency) {
  return (payments || [])
    .filter((p) => p && p.status === "verified" && p.currency === currency && Number.isSafeInteger(p.amountMinor) && p.amountMinor > 0)
    .reduce((sum, p) => sum + p.amountMinor, 0);
}

// Full payment before activation (owner decision). `policy` is a setting so a deposit rule can be added later.
function isEligibleForActivation({ enrolment, invoice, payments, policy = "full_payment" }) {
  const no = (reason) => ({ eligible: false, reason });
  if (!enrolment || enrolment.status !== "approved") return no("Enrolment is not approved");
  if (!invoice || !Number.isSafeInteger(invoice.approvedFeeMinor) || invoice.approvedFeeMinor <= 0) return no("No approved fee");
  if (policy !== "full_payment") return no("Unsupported activation policy");
  const paid = verifiedTotalMinor(payments, invoice.currency);
  if (paid < invoice.approvedFeeMinor) return no("Verified payments do not cover the approved fee");
  return { eligible: true, reason: "Approved and fully paid", paidMinor: paid, overpaidMinor: paid - invoice.approvedFeeMinor };
}

// Server-generated registration reference, e.g. PET-ENR-7K4M9Q2X. No ambiguous characters (0/O, 1/I).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateReference(prefix = "PET-ENR") {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${out}`;
}

module.exports = { ENROLMENT_STATUSES, TRANSITIONS, canTransition, calculateAge, requiresGuardianConsent, toMinorUnits, verifiedTotalMinor, isEligibleForActivation, generateReference };
