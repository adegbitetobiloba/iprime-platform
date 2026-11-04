// Pure rules for payment confirmation, verification, check-in and account deletion. No database, so they are easy to test.
const { requiresGuardianConsent } = require("./enrolmentRules");

const activePayments = (a) => ((a && a.payments) || []).filter((p) => p && !p.voidedAt);
const paymentStatus = (a) => (activePayments(a).length ? "confirmed" : "awaiting");
const totalConfirmedMinor = (a) => activePayments(a).reduce((s, p) => s + (Number.isSafeInteger(p.amountMinor) ? p.amountMinor : 0), 0);
// Only an explicit "true" opens the student form. Missing means closed.
const formUnlocked = (a) => !!(a && a.features && a.features.enrolmentForm === true);
const isVerified = (a) => !!(a && a.verification && a.verification.status === "verified");

// The calendar day and session in Nigeria (West Africa Time, UTC+1, no daylight saving).
const lagosDay = (now = new Date()) => new Date(now.getTime() + 3600 * 1000).toISOString().slice(0, 10);
function sessionFor(now = new Date()) {
  const h = (now.getUTCHours() + 1) % 24;
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

// A student may be checked in normally when the account is approved AND their identity has been officially verified.
function checkInEligibility(user, access) {
  const reasons = [];
  if (user && user.approval && user.approval !== "approved") reasons.push("The account is not approved");
  if (!isVerified(access)) reasons.push("Identity has not been officially verified");
  return { eligible: reasons.length === 0, reasons };
}

// Verifying needs the identity document to have been seen; a student under 18 also needs a guardian contacted.
function verificationProblem(user, input, now = new Date()) {
  if (input.action === "revoke") return input.note && input.note.trim().length >= 5 ? null : "Give a reason for removing the verification.";
  if (input.identityDocumentSeen !== true) return "Confirm that you have seen the student's identity document.";
  if (requiresGuardianConsent(user && user.dob, now) && user && user.dob && input.guardianContacted !== true) return "This student is under 18: confirm that a parent or guardian has been contacted.";
  return null;
}

const DELETED_DOMAIN = "deleted.invalid";
const isDeleted = (user) => !!(user && typeof user.email === "string" && user.email.endsWith(`@${DELETED_DOMAIN}`));

// To delete an account the administrator must type the person's student ID (students) or email (everyone else).
function confirmMatches(user, typed) {
  const want = String((user && (user.role === "student" && user.studentId ? user.studentId : user.email)) || "").trim().toLowerCase();
  return !!want && String(typed || "").trim().toLowerCase() === want;
}

module.exports = { activePayments, paymentStatus, totalConfirmedMinor, formUnlocked, isVerified, lagosDay, sessionFor, checkInEligibility, verificationProblem, DELETED_DOMAIN, isDeleted, confirmMatches };
