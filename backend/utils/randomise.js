// Per-attempt randomisation of question order and option order. Pure (no database), so it is tested on its own.
//
// How it stays safe:
//  - Every attempt gets a random seed when it starts. The same seed always gives the same order, so a refresh,
//    a resume or a second device shows the student exactly what they saw before. Different students get different seeds.
//  - Options keep their stored `key` (the identity the answer key and grading use). Only the DISPLAY order and the
//    displayed letter (`label`) change, so the correct answer can never end up attached to the wrong option.
//  - Questions whose options refer to other options ("All of the above", "A and B", "I and II only") are never
//    option-shuffled, because reordering would change their meaning.
const crypto = require("crypto");
const { OPTION_KEYS } = require("./cbt");

const newSeed = () => crypto.randomBytes(8).toString("hex");

// xmur3 string hash -> mulberry32 generator. Small, fast, deterministic; not for security, only for reproducible ordering.
function rngFrom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (let i = 0; i < String(seed).length; i++) { h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (() => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; })();
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Fisher-Yates on a copy.
function shuffled(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Conservative on purpose: when in doubt, do NOT shuffle that question's options.
const OPTION_REFERENCE = [
  /\b(all|none|both|neither|any|either|every)\b[^.]{0,25}\b(above|these|those|them|options?|answers?|choices?|the\s+(first|second|last|following))\b/i,
  /\b(above|below|preceding|previous|following)\s+(options?|statements?|answers?)\b/i,
  /\b(option|choice|answer|statement)s?\s*\(?[A-F]\)?\b/i,
  /^\s*\(?[A-F]\)?\s*(,|and|&|or|only|but)\b/i,
  /\b[A-F]\s*(,|and|&)\s*[A-F]\b/,
  /^\s*(i{1,3}|iv|v)\s*(,|and|&|only|or)\b/i,
  /\b(i{1,3}|iv)\s*(,|and|&)\s*(i{1,3}|iv)\b/i,
  /\b(all|none)\s+of\s+(the\s+)?(above|these)\b/i,
];
function optionsShufflable(q) {
  const opts = q.options || [];
  if (opts.length < 2) return false;
  return !opts.some((o) => OPTION_REFERENCE.some((rx) => rx.test(String(o.text || ""))));
}

// A question that may only make sense next to others (shared passage, "questions 3 to 5"). Used to WARN, never to block.
const NEIGHBOUR_REFERENCE = [
  /\bquestions?\s+\d+\s*(-|–|to|and)\s*\d+/i,
  /\b(refer|according)\s+to\s+the\s+(passage|text|extract|diagram|table|graph|figure)\b/i,
  /\bthe\s+(passage|extract)\s+(above|below|preceding)\b/i,
  /\b(above|preceding)\s+(passage|text|diagram|table)\b/i,
  /\bread\s+the\s+(following\s+)?(passage|text|extract)\b/i,
];
const dependsOnNeighbours = (q) => NEIGHBOUR_REFERENCE.some((rx) => rx.test(String(q.text || "")));

// The questions THIS attempt was given. An attempt drawn from a pool stores its own list of question ids; every other
// attempt (older ones, or exams where everyone gets everything) has none, and gets the whole exam.
function servedQuestions(exam, attempt) {
  const ids = attempt && Array.isArray(attempt.questionIds) ? attempt.questionIds : null;
  const all = (exam && exam.questions) || [];
  if (!ids || !ids.length) return all;
  const byId = new Map(all.map((q) => [String(q._id), q]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

// Builds the order one attempt sees. Without a seed (older attempts) or with both switches off, nothing moves.
// `settings` come from the ATTEMPT (copied at start), so changing the exam later cannot reshuffle someone mid-exam.
function arrange(questions, settings = {}) {
  const { seed, shuffleQuestions, shuffleOptions } = settings;
  const on = Boolean(seed);
  let order = servedQuestions({ questions }, settings).slice(); // only this attempt's own questions
  if (on && shuffleQuestions) order = shuffled(order, rngFrom(`${seed}:questions`));
  return order.map((q) => {
    let opts = (q.options || []).slice();
    let moved = false;
    if (on && shuffleOptions && optionsShufflable(q)) { opts = shuffled(opts, rngFrom(`${seed}:options:${q._id}`)); moved = true; }
    return { q, moved, options: opts.map((o, i) => ({ key: o.key, label: moved ? OPTION_KEYS[i] : o.key, text: o.text, html: o.html })) };
  });
}

// What the student sees while the exam runs: never the answer key.
const studentView = (entry) => ({
  id: String(entry.q._id),
  text: entry.q.text,
  ...(entry.q.textHtml ? { textHtml: entry.q.textHtml } : {}),
  options: entry.options.map((o) => ({ key: o.key, label: o.label, text: o.text, ...(o.html ? { html: o.html } : {}) })),
  marks: entry.q.marks ?? 1,
  ...(entry.q.topic ? { topic: entry.q.topic } : {}),
});

// What the student sees at review (only when the exam allows it): the SAME order and letters they saw during the exam.
const reviewView = (entry, given) => {
  const q = entry.q;
  const mine = given[String(q._id)] || null;
  const labelOf = (k) => (entry.options.find((o) => o.key === k) || {}).label || k;
  return {
    id: String(q._id), text: q.text, textHtml: q.textHtml || undefined,
    options: entry.options.map((o) => ({ key: o.key, label: o.label, text: o.text, html: o.html || undefined })),
    marks: q.marks ?? 1, yourChoice: mine, yourLabel: mine ? labelOf(mine) : null,
    correctKey: q.correctKey, correctLabel: labelOf(q.correctKey),
    explanation: q.explanation || "", explanationHtml: q.explanationHtml || undefined,
    explanationSource: q.explanation ? (q.explanationSource || "source") : null,
  };
};

module.exports = { servedQuestions, newSeed, rngFrom, shuffled, optionsShufflable, dependsOnNeighbours, arrange, studentView, reviewView };
