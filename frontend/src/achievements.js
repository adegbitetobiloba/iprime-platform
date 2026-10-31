// Achievements register (front-end view).
//
// This list is intentionally EMPTY. Nothing may be added until management has supplied, for each person:
// the approved public name, exam type, exam year, exact score, evidence, and written publication consent
// (parent/guardian consent as well when the person is under 18). Do not copy names or scores from flyers.
//
// When the Administration workstream exposes an approved-achievements API, replace this constant with a fetch.
// isPublishable() stays as the last gate in the browser; the server must enforce the same rules.
//
// Record shape:
// {
//   id: "stable-id",
//   name: "Approved public name",
//   examType: "UTME",              // free text; never label a challenge/test result as a JAMB score
//   year: 2026,
//   score: 355,
//   programme: "Programme or mode attended",   // optional, shown if present
//   verified: true,                // evidence checked by staff
//   evidenceRef: "internal reference",         // required, NEVER displayed publicly
//   consent: "granted",            // written consent to publish name and score
//   isMinor: false,
//   guardianConsent: false,        // required when isMinor is true
//   portrait: { src, alt, width, height },     // optional
//   imageConsent: false,           // required before the portrait is shown
//   testimonial: "", testimonialApproved: false // optional; shown only when approved
// }
export const ACHIEVEMENTS = [];

const hasText = (v) => typeof v === "string" && v.trim().length > 0;

/** True only when every condition for public display is met. Anything doubtful returns false. */
export function isPublishable(a) {
  if (!a || typeof a !== "object") return false;
  if (!hasText(a.name) || !hasText(a.examType) || !hasText(a.evidenceRef)) return false;
  if (!Number.isInteger(a.year) || a.year < 2000 || a.year > 2100) return false;
  if (typeof a.score !== "number" || !Number.isFinite(a.score) || a.score <= 0) return false;
  if (a.verified !== true) return false;
  if (a.consent !== "granted") return false;
  if (a.isMinor === true && a.guardianConsent !== true) return false;
  return true;
}

export function publishableAchievements(list = ACHIEVEMENTS) {
  return list.filter(isPublishable);
}
