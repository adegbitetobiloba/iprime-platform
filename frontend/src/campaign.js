import { IMAGES } from "./siteImages.js";

// Details of the current campaign, taken from the 2027 UTME flyer supplied by the institution.
// Keep ALL campaign facts in this one file so they can be corrected in one place when they change.
// Not shown anywhere on the website: the bank account details printed on the flyer image.
export const CAMPAIGN = {
  title: "2027 UTME Tutorial Programme",
  tagline: "Your journey to a distinction starts here!",
  mode: "Online tutorials",
  startsOn: "2026-11-01",
  startsLabel: "1 November 2026",
  registrationFee: "₦8,000",
  feeNote: "Registration fee as shown on the 2027 flyer. Ask the institution what it covers.",
  flyer: IMAGES.welcome,
  subjectGroups: [
    { id: "science", label: "Science", subjects: ["Physics", "Chemistry", "Biology", "Mathematics"] },
    { id: "commercial", label: "Commercial", subjects: ["Accounting", "Commerce", "Business Studies", "Economics"] },
    { id: "arts", label: "Arts", subjects: ["English", "Literature", "Government", "History", "CRS", "Geography"] },
  ],
  reasons: [
    { title: "Detailed expert tutoring", text: "Learn from students who have previously written JAMB and achieved outstanding UTME scores." },
    { title: "Regular mock examinations", text: "Practise with mock assessments to develop examination readiness and confidence." },
    { title: "Mentorship and academic guidance", text: "Receive guidance, mentorship and support throughout your preparation journey." },
    { title: "Access to study materials", text: "Gain access to relevant learning resources and examination preparation materials." },
    { title: "Detailed progress monitoring", text: "Enjoy structured monitoring and assessment of your academic progress." },
  ],
  contacts: {
    whatsapp: { display: "09097750150", href: "https://wa.me/2349097750150" },
    call: { display: "09028172858", href: "tel:+2349028172858" },
  },
};

/** Whole calendar days from `now` until an ISO date (YYYY-MM-DD, local time). Negative once it has passed. */
export function daysUntil(isoDate, now = new Date()) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start - today) / 86400000);
}

export function countdownText(days) {
  if (days > 1) return `Lectures start in ${days} days`;
  if (days === 1) return "Lectures start tomorrow";
  if (days === 0) return "Lectures start today";
  return "Lectures have begun";
}
