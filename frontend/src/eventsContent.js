import { daysUntil } from "./campaign.js";

// Dated items for the Events and News pages. Only facts printed on the current 2027 flyer are listed. When the institution
// announces more, add them here (or connect an admin-managed source later). Past events are labelled automatically.
export const EVENTS = [
  {
    id: "utme-2027-start",
    title: "2027 UTME Tutorial Programme: lectures commence",
    date: "2026-11-01",
    dateLabel: "1 November 2026",
    where: "Online tutorials",
    text: "Lectures for the 2027 UTME Tutorial Programme commence, as announced on the current flyer.",
    link: { to: "/programmes", label: "Programme details" },
  },
];

/** "upcoming" | "today" | "started", worked out from today's date. */
export function eventState(isoDate, now = new Date()) {
  const d = daysUntil(isoDate, now);
  if (d > 0) return "upcoming";
  if (d === 0) return "today";
  return "started";
}

export const STATE_LABEL = { upcoming: "Upcoming", today: "Today", started: "Has begun" };

export function sortEvents(list) {
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

// Announcements for the News page. Only the current campaign is announced; nothing here is invented.
export const ANNOUNCEMENTS = [
  {
    id: "utme-2027",
    title: "2027 UTME Tutorial Programme: online tutorials",
    text: "The institution's current campaign offers online tutorials for the 2027 UTME, with subjects in Science, Commercial and Arts groups. Lectures commence on 1 November 2026. Contact the institution to enrol and to confirm current details.",
    link: { to: "/programmes", label: "See the programme" },
  },
];
