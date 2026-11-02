import { CAMPAIGN } from "./campaign.js";

// Contact details. ONLY details actually present in the supplied materials are shown, and each carries its status.
// The WhatsApp and phone lines are CONFIRMED official by the institution (2 Nov 2026), as are the learning hours below.
// Email, address and social profiles were not supplied, so they are shown as "to be confirmed" and never invented.
export const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", value: CAMPAIGN.contacts.whatsapp.display, href: CAMPAIGN.contacts.whatsapp.href, action: "Chat on WhatsApp", external: true, status: "official" },
  { id: "call", label: "Telephone", value: CAMPAIGN.contacts.call.display, href: CAMPAIGN.contacts.call.href, action: "Call this number", status: "official" },
  { id: "email", label: "Email", value: null, note: "An official email address has not been confirmed yet.", status: "tbc" },
  { id: "address", label: "Visit the centre", value: null, note: "The public address and directions will be published once the institution confirms them.", status: "tbc" },
  { id: "hours", label: "Learning hours", value: null, hours: [
      { who: "UTME students", when: CAMPAIGN.learningHours },
      { who: "Physical classes for UTME, JSS and SSS", when: CAMPAIGN.physicalClassHours },
    ], note: "Days, term dates and timetables are confirmed for each programme.", status: "official" },
  { id: "social", label: "Social media", value: null, note: "Official social profiles will be linked here once confirmed.", status: "tbc" },
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

/** A programme-specific "ask about this" message. */
export function programmeEnquiry(programmeTitle) {
  return `Hello Prime Excelerate Tutelage. I would like to ask about the ${programmeTitle} programme: current availability, timetable and how to enrol.`;
}
