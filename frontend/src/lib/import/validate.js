// Shared checks used by the text parser and the spreadsheet builder. Never guesses; reports.
import { CODE_INFO, stateFromIssues } from "./codes.js";
import { questionFingerprint } from "./fingerprint.js";

export const LIMITS = { text: 4000, option: 1000, explanation: 4000 };
const VISUAL_RE = /\b(figure|fig\.|diagram|graph|chart|picture|image|shown (?:below|above)|table (?:below|above))\b/i;
const MATH_RE = /[\u2080-\u2089\u00B2\u00B3\u00B9\u2070-\u2079\u207A\u207B\u2192\u21CC\u221A\u2211\u222B\u2264\u2265\u2260\u00B1\u00D7\u00F7\u2206\u0394]/;

export const issue = (code, detail) => ({ code, severity: CODE_INFO[code].severity, detail: detail || null });

// q: { text, options:[{key,text}], correctKey, marks, questionType, imageRef, explanation, inferredAnswer }
export function checkQuestion(q) {
  const out = [];
  const opts = q.options || [];
  const keys = opts.map((o) => o.key);
  const filled = opts.filter((o) => o.text);
  if (!q.text) out.push(issue("NO_TEXT"));
  if (opts.some((o) => !o.text)) out.push(issue("EMPTY_OPTION", `Option ${opts.filter((o) => !o.text).map((o) => o.key).join(", ")} has no text.`));
  if (filled.length < 2) out.push(issue("FEW_OPTIONS", `${filled.length} option(s) found.`));
  if (new Set(keys).size !== keys.length) out.push(issue("DUP_OPTION", "Two options use the same letter."));
  else if (new Set(filled.map((o) => o.text)).size < filled.length) out.push(issue("DUP_OPTION"));
  if (!q.correctKey) out.push(issue("NO_ANSWER", q.answerNote || null));
  else if (!filled.some((o) => o.key === q.correctKey)) out.push(issue("BAD_ANSWER", `Answer ${q.correctKey} but the options with text are ${filled.map((o) => o.key).join("") || "none"}.`));
  if (q.marks !== undefined && q.marks !== null && q.marks !== "" && !(Number(q.marks) >= 0.5 && Number(q.marks) <= 100)) out.push(issue("BAD_MARKS", String(q.marks)));
  if ((q.text || "").length > LIMITS.text || opts.some((o) => o.text.length > LIMITS.option) || (q.explanation || "").length > LIMITS.explanation) out.push(issue("TOO_LONG"));
  if (/diagram/i.test(q.questionType || "")) out.push(issue("VISUAL", q.imageRef ? `Needs diagram "${q.imageRef}", which is not imported.` : "Marked diagram-dependent and no image was supplied."));
  else if (VISUAL_RE.test(q.text || "")) out.push(issue("IMAGE", "Wording refers to a figure, diagram, graph or table."));
  if (MATH_RE.test([q.text, ...opts.map((o) => o.text), q.explanation].join(" "))) out.push(issue("MATH"));
  return out;
}

export function finishQuestion(q) {
  q.issues = [...(q.issues || []), ...checkQuestion(q)];
  q.fingerprint = questionFingerprint(q.text || "", (q.options || []).map((o) => o.text));
  q.state = stateFromIssues(q.issues, { hasExplanation: !!q.explanation });
  q.importable = q.state === "ready" || q.state === "ready_partial";
  return q;
}

// File-level checks: repeated IDs and duplicate questions (same wording AND same option set).
export function crossCheck(questions) {
  const byFp = new Map(), byId = new Map(), byText = new Map();
  for (const q of questions) {
    if (q.text) { if (!byFp.has(q.fingerprint)) byFp.set(q.fingerprint, []); byFp.get(q.fingerprint).push(q); const tk = q.text.normalize("NFKC").replace(/\s+/g, " ").trim(); if (!byText.has(tk)) byText.set(tk, []); byText.get(tk).push(q); }
    if (q.externalId) byId.set(q.externalId, (byId.get(q.externalId) || 0) + 1);
  }
  for (const q of questions) {
    let changed = false;
    if (q.externalId && byId.get(q.externalId) > 1) { q.issues.push(issue("DUP_ID", q.externalId)); changed = true; }
    const g = q.text ? byFp.get(q.fingerprint) : null;
    if (g && g.length > 1) { q.issues.push(issue("DUPLICATE", g.filter((x) => x !== q).map((x) => x.externalId || `#${x.provenance?.row ?? x.provenance?.number ?? "?"}`).join(", "))); changed = true; }
    // same wording, different options: a "likely duplicate" only when most options are shared (>= 60%); otherwise a legitimate repeated stem
    const sameWords = q.text ? byText.get(q.text.normalize("NFKC").replace(/\s+/g, " ").trim()) : null;
    if (sameWords && sameWords.length > 1 && !(g && g.length > 1)) {
      const mine = new Set((q.options || []).map((o) => o.text).filter(Boolean));
      const close = sameWords.filter((x) => x !== q && x.fingerprint !== q.fingerprint && (() => { const theirs = new Set((x.options || []).map((o) => o.text).filter(Boolean)); const both = [...mine].filter((t) => theirs.has(t)).length; return both / Math.max(1, new Set([...mine, ...theirs]).size) >= 0.6; })());
      if (close.length) { q.issues.push(issue("LIKELY_DUPLICATE", close.map((x) => x.externalId || `row ${x.provenance?.row ?? "?"}`).join(", "))); changed = true; }
      else q.repeatedStem = true;
    }
    if (changed) { q.state = stateFromIssues(q.issues, { hasExplanation: !!q.explanation }); q.importable = q.state === "ready" || q.state === "ready_partial"; }
  }
  return questions;
}

export const countBy = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
