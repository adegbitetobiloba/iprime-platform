import { CAMPAIGN } from "./campaign.js";

// Contact details. ONLY details actually present in the supplied materials are shown, and each carries its status.
// The WhatsApp and phone lines are CONFIRMED official by the institution (2 Nov 2026), as are the learning hours below.
// The official email and the social channels were supplied by Mr Okoye on 3 Nov 2026. The address and directions have not been
// supplied, so they are shown as "to be confirmed" and never invented.
export const OFFICIAL_EMAIL = "primeexcelerate@gmail.com";

export const SOCIALS = [
  { id: "facebook", label: "Facebook group", href: "https://www.facebook.com/share/g/1FPiWgCRWa/" },
  { id: "youtube", label: "YouTube", href: "https://youtube.com/@primeexcelerate" },
  { id: "whatsapp-channel", label: "WhatsApp channel", href: "https://whatsapp.com/channel/0029Va6OKtRICVfdw14Znc1V" },
  { id: "telegram", label: "Telegram", href: "https://t.me/+d6iH19YufO5lNjdk" },
  { id: "x", label: "X (Twitter)", href: "https://x.com/inclusiveprime1" },
];

export const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", value: CAMPAIGN.contacts.whatsapp.display, href: CAMPAIGN.contacts.whatsapp.href, action: "Chat on WhatsApp", external: true, status: "official" },
  { id: "call", label: "Telephone", value: CAMPAIGN.contacts.call.display, href: CAMPAIGN.contacts.call.href, action: "Call this number", status: "official" },
  { id: "email", label: "Email", value: OFFICIAL_EMAIL, href: `mailto:${OFFICIAL_EMAIL}`, action: "Send an email", status: "official" },
  { id: "address", label: "Visit the centre", value: null, note: "The public address and directions will be published once the institution confirms them.", status: "tbc" },
  { id: "hours", label: "Learning hours", value: null, hours: [
      { who: "UTME students", when: CAMPAIGN.learningHours },
      { who: "Physical classes for UTME, JSS and SSS", when: CAMPAIGN.physicalClassHours },
    ], note: "Days, term dates and timetables are confirmed for each programme.", status: "official" },
  { id: "social", label: "Follow us", value: null, links: SOCIALS, status: "official" },
];

export const TOPICS = [
  "Programmes and enrolment",
  "Fees and payment",
  "Timetable and intake dates",
  "Using iPrime (account or practice examinations)",
  "Something else",
];

export const MAX_MESSAGE = 600;

/** Checks the enquiry fields. Returns an object of messages keyed by field (empty when everything is valid). */
export function validateEnquiry({ name = "", topic = "", message = "" }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = "Please enter your name.";
  if (!TOPICS.includes(topic)) errors.topic = "Please choose a topic.";
  const m = message.trim();
  if (m.length < 10) errors.message = "Please write at least a short sentence (10 characters).";
  else if (m.length > MAX_MESSAGE) errors.message = `Please keep your message under ${MAX_MESSAGE} characters.`;
  return errors;
}

/** The text that is sent. Plain, readable, no personal data beyond what the person typed. */
export function buildEnquiry({ name, topic, message }) {
  return `Hello Prime Excelerate Tutelage. My name is ${name.trim()}.\nTopic: ${topic}\n\n${message.trim()}`;
}

/** Turns a wa.me base link and some text into a WhatsApp link that opens with the message ready to send. */
export function whatsappLink(baseHref, text) {
  return `${baseHref}?text=${encodeURIComponent(text)}`;
}

/** A mailto: link with the enquiry prepared, for people who prefer email to WhatsApp. */
export function emailLink(topic, text) {
  return `mailto:${OFFICIAL_EMAIL}?subject=${encodeURIComponent(`Enquiry: ${topic}`)}&body=${encodeURIComponent(text)}`;
}

/** A programme-specific "ask about this" message. */
export function programmeEnquiry(programmeTitle) {
  return `Hello Prime Excelerate Tutelage. I would like to ask about the ${programmeTitle} programme: current availability, timetable and how to enrol.`;
}
