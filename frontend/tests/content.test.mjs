// Run with: node --test frontend/tests/content.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import { filterFaqs, FAQS, FAQ_CATEGORIES } from "../src/faqContent.js";
import { validateEnquiry, buildEnquiry, whatsappLink, programmeEnquiry, emailLink, CHANNELS, TOPICS, SOCIALS, OFFICIAL_EMAIL } from "../src/contactContent.js";
import { PROGRAMME_AREAS } from "../src/programmesContent.js";
import { eventState, sortEvents, EVENTS } from "../src/eventsContent.js";

test("every FAQ has a known category and a unique id", () => {
  const cats = new Set(FAQ_CATEGORIES.map((c) => c.id));
  assert.ok(FAQS.every((f) => cats.has(f.cat) && f.q && f.a));
  assert.equal(new Set(FAQS.map((f) => f.id)).size, FAQS.length);
});
test("FAQ links all point at real site routes", () => {
  const ok = ["/about", "/iprime", "/register", "/how-it-works", "/programmes", "/contact", "/exams", "/achievements"];
  FAQS.filter((f) => f.link).forEach((f) => assert.ok(ok.includes(f.link.to), f.link.to));
});
test("FAQ filter: category, search words, and no match", () => {
  assert.ok(filterFaqs(FAQS, { category: "payments" }).every((f) => f.cat === "payments"));
  assert.ok(filterFaqs(FAQS, { query: "timer" }).some((f) => f.id === "timer"));
  assert.ok(filterFaqs(FAQS, { query: "refund transfer" }).length >= 1);
  assert.equal(filterFaqs(FAQS, { query: "zzzzqqq" }).length, 0);
  assert.equal(filterFaqs(FAQS, {}).length, FAQS.length);
});
test("FAQ answers make no unsupported claims about fees, dates or contacts", () => {
  const all = FAQS.map((f) => f.a).join(" ");
  assert.ok(!/18,000/.test(all));
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(all.split(OFFICIAL_EMAIL).join("")));
});
test("enquiry validation", () => {
  assert.deepEqual(Object.keys(validateEnquiry({})).sort(), ["message", "name", "topic"]);
  assert.deepEqual(validateEnquiry({ name: "Ada", topic: TOPICS[0], message: "How do I enrol, please?" }), {});
  assert.ok(validateEnquiry({ name: "Ada", topic: TOPICS[0], message: "x".repeat(601) }).message);
  assert.ok(validateEnquiry({ name: "A", topic: TOPICS[0], message: "long enough message" }).name);
});
test("WhatsApp link encodes the message safely", () => {
  const text = buildEnquiry({ name: " Ada ", topic: TOPICS[1], message: "Is it \u20a68,000 & what's included?" });
  const link = whatsappLink("https://wa.me/2349097750150", text);
  assert.ok(link.startsWith("https://wa.me/2349097750150?text="));
  assert.ok(!/[\n ]/.test(link.split("?text=")[1]));
  assert.equal(decodeURIComponent(link.split("?text=")[1]), text);
  assert.ok(programmeEnquiry("WAEC preparation").includes("WAEC"));
});
test("official channels carry values; only the address is still to be confirmed", () => {
  assert.deepEqual(CHANNELS.filter((c) => c.value).map((c) => c.id).sort(), ["call", "email", "whatsapp"]);
  assert.equal(CHANNELS.find((c) => c.id === "email").href, "mailto:primeexcelerate@gmail.com");
  assert.deepEqual(CHANNELS.filter((c) => c.status === "official").map((c) => c.id).sort(), ["call", "email", "hours", "social", "whatsapp"]);
  assert.deepEqual(CHANNELS.filter((c) => c.status === "tbc").map((c) => c.id), ["address"]);
  assert.ok(CHANNELS.filter((c) => c.status === "tbc").every((c) => !c.value && c.note));
});
test("social links are secure and have no tracking parameters", () => {
  assert.equal(SOCIALS.length, 5);
  assert.ok(SOCIALS.every((s) => s.href.startsWith("https://") && !s.href.includes("?si=")));
});
test("email link is prepared safely", () => {
  const l = emailLink("Fees and payment", "Is it \u20a68,000 & what's included?");
  assert.ok(l.startsWith("mailto:primeexcelerate@gmail.com?subject="));
  assert.ok(!/[\n ]/.test(l));
});
test("learning hours are exactly as confirmed", () => {
  const hours = CHANNELS.find((c) => c.id === "hours").hours;
  assert.deepEqual(hours.map((h) => h.when), ["8:30am to 6:00pm", "4:00pm to 6:00pm"]);
  assert.ok(FAQS.find((f) => f.id === "hours").a.includes("8:30am to 6:00pm") && FAQS.find((f) => f.id === "hours").a.includes("4:00pm and 6:00pm"));
});
test("programmes: only the UTME campaign is marked current, the rest await confirmation", () => {
  assert.deepEqual(PROGRAMME_AREAS.filter((p) => p.status === "current").map((p) => p.id), ["utme"]);
  assert.ok(PROGRAMME_AREAS.every((p) => ["current", "tbc"].includes(p.status)));
  assert.equal(PROGRAMME_AREAS.length, 8);
});
test("event state is worked out from the date", () => {
  assert.equal(eventState("2026-11-01", new Date(2026, 9, 31)), "upcoming");
  assert.equal(eventState("2026-11-01", new Date(2026, 10, 1, 9)), "today");
  assert.equal(eventState("2026-11-01", new Date(2026, 10, 2)), "started");
  assert.equal(sortEvents(EVENTS).length, EVENTS.length);
});
