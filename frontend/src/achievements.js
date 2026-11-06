// Student achievements: the rules for what may be shown, and the starting set from the flyer.
//
// How it works now:
//  - The Programmes page in the admin area manages achievements (name, score, year, photo, consent, show/hide).
//  - The website asks the server (/public/achievements). The server only sends records that are published, verified and consented.
//  - Until an administrator saves the FIRST record, the website shows STARTER_SET below, so the scholars from the flyer are visible straight away.
//    From the moment the first record exists, ONLY the server's list is shown, so hiding or removing someone in the admin removes them everywhere.
//
// STARTER_SET holds exactly what is printed on the flyer, with the owner's confirmation (3 Nov 2026) that the scores are real JAMB scores
// and that consent has been given. Names were not printed for three of them; the card then says "Prime Excelerate scholar".

export const STARTER_SET = [
  {
    id: "starter-355", name: "", label: "JAMB score", examType: "UTME", year: 2026, score: 355, programme: "",
    portrait: { src: "/images/achievers/scholar-355.jpg", alt: "Prime Excelerate scholar who scored 355 in the 2026 UTME", width: 480, height: 600 },
    imageConsent: true, verified: true, consent: "granted", evidenceRef: "Owner confirmation, 3 Nov 2026 (attach the result slip reference in the admin)",
  },
  {
    id: "starter-342", name: "", label: "JAMB score", examType: "UTME", year: null, score: 342, programme: "",
    portrait: { src: "/images/achievers/scholar-342.jpg", alt: "Prime Excelerate scholar who scored 342 in UTME", width: 480, height: 600 },
    imageConsent: true, verified: true, consent: "granted", evidenceRef: "Owner confirmation, 3 Nov 2026 (attach the result slip reference in the admin)",
  },
  {
    id: "starter-362", name: "Bello Jesufolahan Elijah", label: "JAMB score", examType: "UTME", year: 2025, score: 362, programme: "",
    portrait: { src: "/images/achievers/scholar-362.jpg", alt: "Bello Jesufolahan Elijah holding the 2025 UTME Challenge Award", width: 480, height: 600 },
    imageConsent: true, verified: true, consent: "granted", evidenceRef: "Name as written on the award board in the flyer; owner confirmation, 3 Nov 2026. The other flyer lists 361: confirm 361 or 362 from the result slip.",
  },
  {
    id: "starter-344", name: "", label: "JAMB score", examType: "UTME", year: null, score: 344, programme: "",
    portrait: { src: "/images/achievers/scholar-344.jpg", alt: "Prime Excelerate scholar who scored 344 in UTME", width: 480, height: 600 },
    imageConsent: true, verified: true, consent: "granted", evidenceRef: "Owner confirmation, 3 Nov 2026 (attach the result slip reference in the admin)",
  },
];

/** Photos the admin can attach to a record. Add a file to frontend/public/images/achievers/ and list it here to offer it. */
export const PORTRAIT_FILES = [
  { path: "/images/achievers/scholar-355.jpg", label: "Scholar 355 (flyer)" },
  { path: "/images/achievers/scholar-342.jpg", label: "Scholar 342 (flyer)" },
  { path: "/images/achievers/scholar-362.jpg", label: "Scholar 362 (flyer)" },
  { path: "/images/achievers/scholar-344.jpg", label: "Scholar 344 (flyer)" },
];

/** Same rule as the server (backend/utils/achievers.js). A name and a year are optional; verification and consent are not. */
export function isPublishable(a) {
  if (!a || typeof a !== "object") return false;
  if (typeof a.score !== "number" || !Number.isFinite(a.score) || a.score <= 0) return false;
  if (a.verified !== true) return false;
  if (a.consent !== "granted") return false;
  if (a.isMinor === true && a.guardianConsent !== true) return false;
  return true;
}

export function publishableAchievements(list = STARTER_SET) {
  return list.filter(isPublishable);
}

/** Turns a server record (already checked on the server) into the shape the card draws. */
export function fromApi(a) {
  return {
    id: a.id, name: a.name || "", label: a.label || "", examType: a.examType || "", year: a.year || null, score: a.score, programme: a.programme || "",
    portrait: a.portrait ? { src: a.portrait.src, alt: a.portrait.alt, width: 480, height: 600 } : null,
    imageConsent: Boolean(a.portrait),
    testimonial: a.testimonial || "", testimonialApproved: Boolean(a.testimonial),
    verified: true, consent: "granted",
  };
}

/** Why an admin's record is hidden (or null when it is visible). Mirrors the server rule so the admin screen can explain it. */
export function hiddenReason(a) {
  if (a.archived) return "Archived";
  if (!a.published) return "Not switched on";
  if (a.consent !== "granted") return a.consent === "withdrawn" ? "Consent withdrawn" : "Consent pending";
  if (!a.verified) return "Not verified";
  if (a.isMinor && !a.guardianConsent) return "Guardian consent needed";
  if (!(Number.isFinite(a.score) && a.score > 0)) return "Score missing";
  return null;
}
