const crypto = require("crypto");
const { requiresGuardianConsent } = require("./enrolmentRules");

// The statements printed on the paper form. The owner must approve the final wording; the hash records exactly what was agreed.
const STUDENT_COMMITMENT_TEXT = "I agree to attend classes regularly, complete assignments, respect staff and protect tutorial facilities, and uphold the values of Prime Excelerate Tutelage.";
const GUARDIAN_CONSENT_TEXT = "I certify that information provided is correct and agree to the tutorials payment policy and regulation.";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const POLICY_VERSION = process.env.ENROLMENT_POLICY_VERSION || "unconfirmed-v0";

// Returns a list of plain-language problems. Empty means the application can be submitted.
function missingForSubmit(e, ack = {}, now = new Date()) {
  const problems = [];
  const has = (v) => typeof v === "string" && v.trim().length > 0;
  if (!e.programmeId) problems.push("Choose a programme.");
  if (!e.student || !e.student.dob) problems.push("Enter the date of birth.");
  if (!e.student || !has(e.student.phone)) problems.push("Enter a phone number.");
  if (!e.studyMode) problems.push("Choose Physical, Online or Hybrid.");
  if (!e.session) problems.push("Choose Morning, Afternoon or Evening.");
  if (!Array.isArray(e.subjectsRequested) || e.subjectsRequested.length === 0) problems.push("Choose at least one subject.");
  if (ack.studentCommitment !== true) problems.push("Accept the student commitment.");
  const minor = requiresGuardianConsent(e.student && e.student.dob, now);
  if (minor) {
    const g = e.guardian || {};
    if (!has(g.name) || !has(g.relationship) || !has(g.phone)) problems.push("Enter the parent or guardian's name, relationship and phone number.");
    if (!ack.guardian || !has(ack.guardian.signerName) || !has(ack.guardian.relationship)) problems.push("The parent or guardian must give consent.");
  }
  return { problems, minor };
}

function buildConsents(ack, minor, now = new Date()) {
  const out = [{ kind: "student_commitment", typedAcknowledgement: true, policyVersion: POLICY_VERSION, textHash: sha(STUDENT_COMMITMENT_TEXT), at: now }];
  if (minor && ack.guardian) out.push({ kind: "guardian_consent", signerName: ack.guardian.signerName, relationship: ack.guardian.relationship, typedAcknowledgement: true, policyVersion: POLICY_VERSION, textHash: sha(GUARDIAN_CONSENT_TEXT), at: now });
  return out;
}

module.exports = { missingForSubmit, buildConsents, STUDENT_COMMITMENT_TEXT, GUARDIAN_CONSENT_TEXT, POLICY_VERSION };
