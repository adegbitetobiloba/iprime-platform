// Parser for ID-style question banks (lines like "ORL-0001 stem ..."), working on ordered lines
// from pdfLayout. Source fidelity rules: nothing is invented, repaired or completed. Anything that
// cannot be determined is recorded as an issue. Original and corrected answer keys are both kept.
import { CODE_INFO, stateFromIssues } from "./codes.js";
import { questionFingerprint } from "./fingerprint.js";

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];
const ID_RE = /^([A-Z]{2,6})-(\d{3,6})(?:\s+(.*))?$/;
const ID_MODE_MIN_LINES = 5;
const OPT_RE = /^([A-F])[.)](?:\s+(.*))?$/;
const ANSWER_RE = /^Answer\s*:\s*(.*)$/i;
const SOURCE_RE = /^Sources?\s*:\s*(.*)$/i;
const EDITOR_RE = /^Editor\s*:\s*(.*)$/i;
const FLAG_RE = /^\u26A0\uFE0F?\s*(.*)$/;
const HEADING_RE = /^([A-Z][A-Za-z' &\-]{2,40}?)\s*\((\d{1,4})\)$/;
const KEY_HEADING_RE = /^(quick\s+)?answer\s+key\b\s*(.*)$/i;
const REFS_ONLY_RE = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+(\s*,\s*[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)*\s*,?$/;
const COMMON_SHORT = new Set("a i of to in is it as at be by do go he if me my no on or so up us we am an ah oh hi ok mr dr".split(" "));
const VISUAL_RE = /\b(figure|fig\.|diagram|graph|chart|picture|image|shown (?:below|above)|table (?:below|above))\b/i;
const MATH_RE = /[\u2080-\u2089\u00B2\u00B3\u00B9\u2070-\u2079\u207A\u207B\u2192\u21CC\u221A\u2211\u222B\u2264\u2265\u2260\u00B1\u00D7\u00F7\u2206\u0394]/;
const LIMITS = { text: 4000, option: 1000, explanation: 2000 };

// (Re)compute state and importability from the question's issues. Importable = Ready only, by default.
export function classifyQuestion(q) {
  q.state = stateFromIssues(q.issues, { hasExplanation: !!q.explanation });
  q.importable = q.state === "ready" || q.state === "ready_partial";
  return q;
}

export function isIdMode(lines) {
  return lines.filter((l) => ID_RE.test(l.text)).length >= ID_MODE_MIN_LINES;
}

const join = (parts) => parts.join(" ").replace(/\s+/g, " ").trim();

function newQuestion(m, line, section) {
  return {
    externalId: `${m[1]}-${m[2]}`,
    idNumber: m[2],
    section: section || null,
    stemLines: m[3] !== undefined ? [m[3]] : [],
    options: [],
    answerRaw: null,
    explanationLines: [],
    editorLines: [],
    flags: [],
    sourceRefs: [],
    provenance: { pageStart: line.page, pageEnd: line.page, col: line.col },
    state: "stem",
    artefacts: [],
    extra: [],
  };
}

function parseAnswer(raw) {
  // "B", "B (source key C corrected)", "A, B"
  const m = raw.match(/^([A-F])\b\s*(.*)$/);
  if (!m) return { letter: null, sourceKey: null, note: raw || null, multi: false, none: raw === "" };
  let rest = m[2];
  let sourceKey = null;
  const c = rest.match(/\(\s*source key\s+([A-F])\s+corrected\s*\)/i);
  if (c) { sourceKey = c[1].toUpperCase(); rest = rest.replace(c[0], "").trim(); }
  const multi = /^[,&/]\s*[A-F]\b/.test(rest) || /^(and|or)\s+[A-F]\b/i.test(rest);
  return { letter: multi ? null : m[1], sourceKey, note: rest || null, multi, none: false };
}

function finalise(q, ctx) {
  const issues = [];
  const add = (code, detail) => issues.push({ code, severity: CODE_INFO[code].severity, detail: detail || null });

  // Stem: strip lone leading artefacts (".", "*") and record that we did, never silently.
  let stemLines = [...q.stemLines];
  while (stemLines.length && /^[.*\u2022\s]+$/.test(stemLines[0])) q.artefacts.push(stemLines.shift().trim() || "(blank)");
  const text = join(stemLines).replace(/^[.*]\s+/, (m0) => { q.artefacts.push(m0.trim()); return ""; });
  const ans = q.answerRaw === null ? null : parseAnswer(q.answerRaw);
  const explanation = join(q.explanationLines);
  const editorNote = join(q.editorLines);

  if (!text) add("NO_TEXT", "The source has no question text after the ID (only an extraction artefact).");
  if (q.options.length < 2) add("FEW_OPTIONS", `${q.options.length} option(s) found.`);
  for (const o of q.options) if (!o.text) add("EMPTY_OPTION", `Option ${o.key} is empty.`);
  // case-sensitive on purpose: stress/emphasis options differ only by capitals
  const norm = q.options.map((o) => o.text.replace(/\s+/g, " ").trim());
  if (new Set(norm.filter(Boolean)).size < norm.filter(Boolean).length) add("DUP_OPTION");

  if (!ans || ans.none || (ans.letter === null && !ans.multi)) add("NO_ANSWER", ans?.note ? `Could not read an answer from: ${ans.note}` : null);
  else if (ans.multi) { add("MULTI", q.answerRaw); add("NO_ANSWER", "Several letters given; none chosen."); }
  else if (!q.options.some((o) => o.key === ans.letter)) add("BAD_ANSWER", `Answer ${ans.letter} but options are ${q.options.map((o) => o.key).join("") || "none"}.`);
  if (ans?.sourceKey) add("KEY_CORRECTED", `Source key ${ans.sourceKey} corrected to ${ans.letter}.`);
  for (const f of q.flags) {
    add("SOURCE_FLAG", f);
    if (/incomplete/i.test(f)) add("INCOMPLETE", f);
  }
  // An option that swallowed another option's full text (seen in the real Vol1 file, ORL-0102): keep, flag.
  for (const a of q.options) for (const b of q.options) {
    if (a !== b && b.text.length >= 15 && a.text.length > b.text.length && a.text.includes(b.text)) q.extra.push(`Option ${a.key} contains the full text of option ${b.key}`);
  }
  if (q.extra.length) add("EXTRA_TEXT", q.extra.join(" | "));

  // UNDERLINE: ID-style banks only. Headword line with detached 1-2 letter fragments ("f oot", "pa th").
  const last = stemLines[stemLines.length - 1] || "";
  if (last && last.length <= 30 && !/[.?:!]/.test(last)) {
    const toks = last.replace(/^[A-Z]{2,6}-\d+\s*/, "").split(/\s+/);
    const shortFragment = toks.length > 1 && toks.some((t) => /^\p{L}{1,2}$/u.test(t) && !COMMON_SHORT.has(t.toLowerCase()));
    // a two-word alphabetic headword ("plat eau", "Res earch") is also suspicious; heuristic only
    const splitHeadword = toks.length === 2 && toks.every((t) => /^\p{L}{3,}$/u.test(t)) && !COMMON_SHORT.has(toks[0].toLowerCase());
    if (shortFragment || splitHeadword) add("UNDERLINE", last);
  }
  const everything = [text, ...q.options.map((o) => o.text), explanation].join(" ");
  if (MATH_RE.test(everything)) add("MATH");
  if (VISUAL_RE.test(text)) add("IMAGE", "Wording refers to a figure, diagram, graph or table.");
  if (text.length > LIMITS.text || q.options.some((o) => o.text.length > LIMITS.option) || explanation.length > LIMITS.explanation) add("TOO_LONG");

  return {
    externalId: q.externalId,
    idNumber: q.idNumber,
    section: q.section,
    text,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
    correctKey: ans && ans.letter && !ans.multi ? ans.letter : null,
    sourceKey: ans?.sourceKey || null,
    answerRaw: q.answerRaw,
    explanation,
    explanationSource: explanation ? "source" : null,
    editorNote: editorNote || null,
    flags: q.flags,
    sourceRefs: q.sourceRefs,
    provenance: q.provenance,
    stemArtefactsRemoved: q.artefacts,
    issues,
    fingerprint: questionFingerprint(text, q.options.map((o) => o.text)),
  };
}

export function parseKeySection(lines) {
  const entries = new Map();
  let truncated = 0, duplicates = 0;
  for (const l of lines) {
    const t = l.text;
    for (const m of t.matchAll(/(\d{3,6}):([A-F])\b/g)) {
      if (entries.has(m[1])) duplicates++;
      entries.set(m[1], { answer: m[2], page: l.page });
    }
    // bare "0" tokens are entries cut off by the source; counted, never completed
    truncated += (t.replace(/\d{3,6}:[A-F]/g, " ").match(/(?:^|\s)\d{1,2}(?=\s|$)/g) || []).length;
  }
  return { entries, truncated, duplicates };
}

export function parseIdLines(lines, opts = {}) {
  const questions = [];
  const sections = [];
  const unattached = [];
  const keyLines = [];
  const seenIds = new Map();
  let current = null, section = null, inKey = false, mode = "pre";

  const close = () => { if (current) { questions.push(finalise(current, opts)); current = null; } };

  for (const line of lines) {
    const t = line.text.trim();
    if (!t) continue;
    if (inKey) { keyLines.push(line); continue; }
    const km = t.match(KEY_HEADING_RE);
    if (km) { // the heading can share a baseline with key cells, so keep the remainder of the line
      close(); inKey = true;
      if (km[2]) keyLines.push({ ...line, text: km[2] });
      continue;
    }

    const idm = t.match(ID_RE);
    if (idm) {
      close();
      current = newQuestion(idm, line, section);
      const n = (seenIds.get(current.externalId) || 0) + 1;
      seenIds.set(current.externalId, n);
      if (n > 1) current.dupId = true;
      mode = "stem";
      continue;
    }
    const hm = t.match(HEADING_RE);
    if (hm && !OPT_RE.test(t) && !ANSWER_RE.test(t) && !SOURCE_RE.test(t)) {
      // section heading, e.g. "Consonant sounds (84)"
      if (current && mode !== "between" && mode !== "src") { /* heading inside a question that lacks a Source line: still a heading */ }
      close();
      section = hm[1].trim();
      sections.push({ name: section, declared: Number(hm[2]), page: line.page });
      mode = "between";
      continue;
    }
    if (!current) { unattached.push({ page: line.page, col: line.col, text: t }); continue; }
    current.provenance.pageEnd = line.page;

    const ansm = t.match(ANSWER_RE);
    if (ansm && (mode === "stem" || mode === "opts")) { current.answerRaw = ansm[1].trim(); mode = "expl"; continue; }
    if (mode === "stem" || mode === "opts") {
      const om = t.match(OPT_RE);
      const expected = OPTION_KEYS[current.options.length];
      if (om && om[1] === expected) { current.options.push({ key: om[1], text: (om[2] || "").trim() }); mode = "opts"; continue; }
      if (om && mode === "opts") { // option marker out of sequence: keep text, flag it
        current.options[current.options.length - 1].text = join([current.options[current.options.length - 1].text, t]);
        current.extra.push(`Out-of-order option marker "${om[1]}." kept as text`);
        continue;
      }
      if (mode === "stem") { current.stemLines.push(t); continue; }
      const lastOpt = current.options[current.options.length - 1];
      lastOpt.text = join([lastOpt.text, t]); // wrapped option text
      continue;
    }
    // After the Answer line
    const sm = t.match(SOURCE_RE);
    if (sm) {
      current.sourceRefs.push(...sm[1].split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean));
      mode = "src";
      continue;
    }
    const em = t.match(EDITOR_RE);
    if (em) { current.editorLines.push(em[1]); mode = "editor"; continue; }
    const fm = t.match(FLAG_RE);
    if (fm) { current.flags.push((fm[1] || "").trim() || "(unspecified flag)"); mode = "flag"; continue; }
    if (mode === "src") {
      if (REFS_ONLY_RE.test(t)) { current.sourceRefs.push(...t.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean)); continue; }
      unattached.push({ page: line.page, col: line.col, text: t, after: current.externalId });
      continue;
    }
    if (mode === "editor") { current.editorLines.push(t); continue; }
    if (mode === "flag") { current.flags[current.flags.length - 1] = join([current.flags[current.flags.length - 1], t]); continue; }
    if (mode === "expl") { current.explanationLines.push(t); continue; }
    unattached.push({ page: line.page, col: line.col, text: t });
  }
  close();

  // Cross-checks: duplicate IDs, answer key, duplicate questions.
  const key = parseKeySection(keyLines);
  const byFp = new Map();
  for (const q of questions) {
    if (!byFp.has(q.fingerprint)) byFp.set(q.fingerprint, []);
    byFp.get(q.fingerprint).push(q);
  }
  let keyMatched = 0, keyMissing = 0;
  for (const q of questions) {
    if ((seenIds.get(q.externalId) || 0) > 1) q.issues.push({ code: "DUP_ID", severity: "warning", detail: q.externalId });
    const group = byFp.get(q.fingerprint);
    if (q.text && group.length > 1) q.issues.push({ code: "DUPLICATE", severity: "warning", detail: group.filter((g) => g !== q).map((g) => g.externalId).join(", ") });
    const k = key.entries.get(q.idNumber.slice(-4)) || key.entries.get(q.idNumber);
    if (k) {
      keyMatched++;
      q.answerKey = k.answer;
      if (q.correctKey && k.answer !== q.correctKey) q.issues.push({ code: "KEY_CONFLICT", severity: "warning", detail: `Answer ${q.correctKey} vs key ${k.answer}` });
    } else keyMissing++;
    classifyQuestion(q);
  }
  const orphan = [...key.entries.keys()].filter((n) => !questions.some((q) => q.idNumber.endsWith(n)));

  const counts = {};
  for (const q of questions) counts[q.state] = (counts[q.state] || 0) + 1;
  const withCounts = sections.map((s) => ({ ...s, found: questions.filter((q) => q.section === s.name).length }));
  const sectionReport = withCounts.filter((s) => s.found > 0);
  const frontMatterHeadings = withCounts.filter((s) => s.found === 0);
  return {
    questions,
    report: {
      total: questions.length,
      byState: counts,
      importable: questions.filter((q) => q.importable).length,
      sections: sectionReport,
      frontMatterHeadings,
      key: { entries: key.entries.size, truncated: key.truncated, duplicates: key.duplicates, matched: keyMatched, questionsWithoutKeyEntry: keyMissing, keyEntriesWithoutQuestion: orphan },
      unattachedLines: unattached,
      issueCounts: questions.flatMap((q) => q.issues).reduce((a, i) => ((a[i.code] = (a[i.code] || 0) + 1), a), {}),
    },
  };
}
