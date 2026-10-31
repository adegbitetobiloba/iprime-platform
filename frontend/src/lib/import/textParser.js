// Generic plain-text question parser (numbered "1." / "1)" / "Q:" / "Question 1:" styles), also used for non-ID PDFs.
// Rules: question numbers obey a sequence guard; option lines run in order A, B, C...; several options on one line are
// split only on ordered markers; ticks/stars mark an answer ONLY as a flagged guess; nothing is invented.
import { issue, finishQuestion, crossCheck, countBy } from "./validate.js";

const OPT_LETTERS = "ABCDEF";
const START_RE = /^(?:Q(?:uestion)?\s*(\d+)\s*[:.)]|Q\s*[:.)]|(\d+)\s*[.)])\s*(.*)$/i;
const ANSWER_RE = /^(?:answer|ans|correct(?:\s+answer)?|key)\s*[:=\-]\s*\(?([A-Fa-f])\)?(?:\s*[.)])?\s*(.*)$/i;
const EXPL_RE = /^(?:explanation|solution|rationale|reason)\s*[:\-]\s*(.*)$/i;
const FIELD_RE = /^(marks?|topic|subject|source)\s*[:=]\s*(.+)$/i;
const KEY_RUN_RE = /^(?:\s*\d+\s*[-.:)]\s*[A-Fa-f]\b[\s,;]*){3,}$/;
const TICK_END_RE = /\s*(?:[\u2713\u2714\u2705\u2605\u2B50]|\((?:correct|ans(?:wer)?|right)\))\s*$/i;

// Split "A. Earth  B. Jupiter  C. Mars" into options. Markers must run in order starting at `expected`.
// Returns null when the line does not start with the expected marker.
export function splitInlineOptions(line, expected = 0) {
  const re = /(?:^|\s)\(?([A-Fa-f])[.)]\s+/g;
  const hits = [];
  let m, next = expected;
  while ((m = re.exec(line + " "))) {
    const letter = m[1].toUpperCase();
    if (letter !== OPT_LETTERS[next]) { re.lastIndex = m.index + 1; continue; }
    const start = m.index + (m[0].startsWith(" ") || /^\s/.test(m[0]) ? m[0].search(/\S/) : 0);
    hits.push({ letter, start, textStart: m.index + m[0].length });
    next++;
    if (next >= OPT_LETTERS.length) break;
  }
  if (!hits.length || line.search(/\S/) !== hits[0].start) return null;
  return hits.map((h, i) => ({ key: h.letter, text: line.slice(h.textStart, i + 1 < hits.length ? hits[i + 1].start : undefined).trim() }));
}

function takeTick(text) {
  const m = text.match(TICK_END_RE);
  if (m) return { text: text.slice(0, m.index).trim(), ticked: true };
  if (/^\*\s*\S/.test(text)) return { text: text.replace(/^\*\s*/, "").trim(), ticked: true };
  return { text, ticked: false };
}

// One block of text holding a whole question (used for "question + options in ONE spreadsheet cell").
export function parseQuestionBlock(block) {
  const lines = String(block ?? "").split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
  if (!lines.length) return { questions: [], report: { total: 0 } };
  const first = lines[0].trim();
  // The first line is the stem. Give it a start marker so the normal rules apply, unless it has one.
  const body = START_RE.test(first) ? lines : [`Q: ${first}`, ...lines.slice(1)];
  return parseTextQuestions(body);
}

export function parseTextQuestions(input) {
  const lines = (Array.isArray(input) ? input : String(input ?? "").split(/\r?\n/)).map((l) => (typeof l === "string" ? { text: l, page: null } : l));
  const questions = [], unattached = [];
  const keyRuns = [];
  let cur = null, lastNum = 0, last = "stem";

  const close = () => { if (cur) { questions.push(cur); cur = null; } };
  const open = (num, firstText, ln) => {
    close();
    cur = { number: num, externalId: undefined, text: firstText || "", options: [], correctKey: undefined, explanation: "", issues: [], provenance: { number: num ?? questions.length + 1, page: ln.page ?? undefined } };
    if (num) lastNum = num;
    last = "stem";
  };

  for (const ln of lines) {
    const raw = ln.text ?? "";
    const t = raw.trim();
    if (!t) continue;
    if (KEY_RUN_RE.test(t)) { keyRuns.push(...[...t.matchAll(/(\d+)\s*[-.:)]\s*([A-Fa-f])\b/g)].map((m) => [Number(m[1]), m[2].toUpperCase()])); close(); continue; }

    let m;
    if (cur && (m = t.match(ANSWER_RE))) { cur.correctKey = m[1].toUpperCase(); last = "answer"; continue; }
    if (cur && (m = t.match(EXPL_RE))) { cur.explanation = m[1]; last = "explanation"; continue; }
    if (cur && (m = t.match(FIELD_RE))) {
      const k = m[1].toLowerCase();
      if (k.startsWith("mark")) cur.marks = Number(m[2]); else if (k === "topic") cur.topic = m[2].trim(); else if (k === "subject") cur.subject = m[2].trim(); else cur.sourceRefs = [m[2].trim()];
      last = "field"; continue;
    }
    // options (also several on one line)
    if (cur && (last === "stem" || last === "option")) {
      const opts = splitInlineOptions(t, cur.options.length);
      if (opts) {
        for (const o of opts) { const { text, ticked } = takeTick(o.text); cur.options.push({ key: o.key, text }); if (ticked) (cur.ticked ||= []).push(o.key); }
        last = "option"; continue;
      }
    }
    // a new question?
    if ((m = t.match(START_RE))) {
      const explicit = /^Q/i.test(t);
      const n = m[1] ? Number(m[1]) : m[2] ? Number(m[2]) : null;
      const accept = explicit || !cur || n === lastNum + 1 || (cur.options.length >= 2 && (cur.correctKey || cur.ticked));
      if (accept) { open(n, m[3], ln); continue; }
    }
    if (!cur) { unattached.push({ page: ln.page ?? null, text: t }); continue; }
    // continuation of the previous field
    if (last === "option") { const o = cur.options[cur.options.length - 1]; o.text = `${o.text} ${t}`.trim(); }
    else if (last === "explanation") cur.explanation = `${cur.explanation} ${t}`.trim();
    else if (last === "stem") cur.text = `${cur.text} ${t}`.trim();
    else { cur.issues.push(issue("EXTRA_TEXT", t.slice(0, 80))); cur.text = `${cur.text} ${t}`.trim(); }
  }
  close();

  const keyMap = new Map(keyRuns);
  for (const q of questions) {
    q.text = q.text.trim();
    if (q.ticked && q.ticked.length) {
      const tk = [...new Set(q.ticked)];
      if (tk.length > 1) q.issues.push(issue("MULTI", `Several options were marked: ${tk.join(", ")}.`));
      else if (!q.correctKey) { q.correctKey = tk[0]; q.issues.push(issue("ANSWER_INFERRED", `Taken from the mark on option ${tk[0]}; please confirm.`)); }
      else if (q.correctKey !== tk[0]) q.issues.push(issue("KEY_CONFLICT", `Answer line says ${q.correctKey} but option ${tk[0]} is marked.`));
    }
    const k = q.number ? keyMap.get(q.number) : undefined;
    if (k) {
      if (!q.correctKey) { q.correctKey = k; q.issues.push(issue("ANSWER_INFERRED", `Taken from the answer list at the end (${q.number}-${k}); please confirm.`)); }
      else if (q.correctKey !== k) q.issues.push(issue("KEY_CONFLICT", `Question says ${q.correctKey} but the answer list says ${k}.`));
    }
    delete q.ticked;
    finishQuestion(q);
  }
  crossCheck(questions);
  return {
    questions,
    report: { total: questions.length, byState: countBy(questions, (q) => q.state), unattachedLines: unattached, answerListEntries: keyMap.size, issueCounts: countBy(questions.flatMap((q) => q.issues), (i) => i.code) },
  };
}
