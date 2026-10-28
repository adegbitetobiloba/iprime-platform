import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseIdLines, isIdMode, parseKeySection } from "../../src/lib/import/idParser.js";
import { CODE_INFO } from "../../src/lib/import/codes.js";
import { questionFingerprint, normaliseForFingerprint } from "../../src/lib/import/fingerprint.js";

const L = (text, page = 1) => ({ page, col: "L", top: 0, text });
const lines = (arr, page = 1) => arr.map((t) => L(t, page));
const parse = (arr) => parseIdLines(lines(arr));
const byId = (r, id) => r.questions.find((q) => q.externalId === id);

test("ID mode needs at least 5 ID lines", () => {
  assert.equal(isIdMode(lines(["ORL-0001 a", "ORL-0002 b", "ORL-0003 c", "ORL-0004 d"])), false);
  assert.equal(isIdMode(lines(["ORL-0001 a", "ORL-0002 b", "ORL-0003 c", "ORL-0004 d", "ORL-0005 e"])), true);
});

test("the next question is never absorbed into the previous explanation, and Source/Editor/flag are separated", () => {
  const r = parse([
    "ORL-0031 /θ/", "A. without", "B. mouth", "C. neither", "D. health", "Answer: D",
    "The /θ/ sound is a voiceless", "dental fricative.", "Editor: mouth and health both contain /θ/;", "verify.", "⚠ VERIFY", "Source: E4-X07-Q016",
    "ORL-0032 marks", "A. exist", "B. mosque", "Answer: D", "x", "Source: E4-X07-Q033",
  ]);
  const q = byId(r, "ORL-0031");
  assert.equal(q.explanation, "The /θ/ sound is a voiceless dental fricative.");
  assert.equal(q.editorNote, "mouth and health both contain /θ/; verify.");
  assert.deepEqual(q.flags, ["VERIFY"]);
  assert.deepEqual(q.sourceRefs, ["E4-X07-Q016"]);
  assert.equal(byId(r, "ORL-0032").explanation, "x");
});

test("'Answer: B (source key C corrected)' keeps both keys and flags it", () => {
  const q = byId(parse(["ORL-0005 judge", "A. a", "B. b", "C. c", "D. d", "Answer: B (source key C corrected)", "why", "Source: E2-X03-Q050"]), "ORL-0005");
  assert.equal(q.correctKey, "B"); assert.equal(q.sourceKey, "C");
  assert.ok(q.issues.some((i) => i.code === "KEY_CORRECTED"));
  assert.equal(q.state, "needs_review"); assert.equal(q.importable, false);
});

test("a stem the source lost is NO_TEXT, never filled in; leading '.' and '*' artefacts are recorded", () => {
  const q = byId(parse(["ORL-0399 .", "A. command", "B. invent", "Answer: B", "Source: E4-X19-Q098"]), "ORL-0399");
  assert.equal(q.text, ""); assert.ok(q.issues.some((i) => i.code === "NO_TEXT")); assert.deepEqual(q.stemArtefactsRemoved, ["."]);
  assert.equal(q.importable, false);
  const w = byId(parse(["ORL-0070 .", "*", "knot", "A. nom", "B. king", "Answer: A", "Source: E4-X21-Q009"]), "ORL-0070");
  assert.equal(w.text, "knot"); assert.deepEqual(w.stemArtefactsRemoved, [".", "*"]);
});

test("STEM INCOMPLETE flag makes the question incomplete, not ready", () => {
  const q = byId(parse(["ORL-0107 Did you hear the movie?", "A. No", "B. Yes", "Answer: A", "⚠ STEM INCOMPLETE", "Source: E4-X03-Q002"]), "ORL-0107");
  assert.equal(q.state, "incomplete");
});

test("options that differ only by capitals are NOT duplicate options (stress banks)", () => {
  const q = byId(parse(["ORL-0120 presidency", "A. PRE-si-den-cy", "B. pre-si-DEN-cy", "C. pre-si-den-CY", "D. pre-SI-den-cy", "Answer: A", "Source: s"]), "ORL-0120");
  assert.ok(!q.issues.some((i) => i.code === "DUP_OPTION"));
});

test("an option that swallowed another option's text is flagged and kept as found", () => {
  const q = byId(parse(["ORL-0102 stem", "A. Did she distinctly recollect every detail?Did she scarcely recollect any nuance?", "B. other", "C. Did she scarcely recollect any nuance?", "Answer: C", "Source: s"]), "ORL-0102");
  assert.ok(q.issues.some((i) => i.code === "EXTRA_TEXT"));
  assert.ok(q.options[0].text.includes("?Did she scarcely"));
});

test("wrapped option text is joined; an out-of-order option marker is kept as text and flagged", () => {
  const q = byId(parse(["ORL-0092 stem", "A. first", "B. Did he travel more than", "20 kilometres?", "D. out of order", "Answer: B", "Source: s"]), "ORL-0092");
  assert.equal(q.options[1].text, "Did he travel more than 20 kilometres? D. out of order");
  assert.ok(q.issues.some((i) => i.code === "EXTRA_TEXT"));
});

test("missing answer, answer pointing at a missing option, and multiple answers are errors/warnings, not guesses", () => {
  const r = parse(["ORL-1001 s", "A. a", "B. b", "Answer:", "Source: s", "ORL-1002 s", "A. a", "B. b", "Answer: E", "Source: s", "ORL-1003 s", "A. a", "B. b", "Answer: A, B", "Source: s"]);
  assert.ok(byId(r, "ORL-1001").issues.some((i) => i.code === "NO_ANSWER"));
  assert.ok(byId(r, "ORL-1002").issues.some((i) => i.code === "BAD_ANSWER"));
  const m = byId(r, "ORL-1003"); assert.equal(m.correctKey, null); assert.ok(m.issues.some((i) => i.code === "MULTI"));
});

test("answer key: truncated entries are counted and never completed; conflicts and gaps are reported", () => {
  const r = parseIdLines([
    ...lines(["ORL-0001 a", "A. x", "B. y", "Answer: A", "Source: s", "ORL-0002 b", "A. x", "B. y", "Answer: B", "Source: s", "ORL-0003 c", "A. x", "B. y", "Answer: A", "Source: s"]),
    ...lines(["Quick answer key 0002:A 0003:A 0", "0099:C"], 2),
  ]);
  assert.equal(r.report.key.entries, 3);
  assert.equal(r.report.key.truncated, 1);
  assert.deepEqual(r.report.key.keyEntriesWithoutQuestion, ["0099"]);
  assert.ok(byId(r, "ORL-0002").issues.some((i) => i.code === "KEY_CONFLICT"));
  assert.equal(byId(r, "ORL-0002").state, "conflicting_answer");
  assert.equal(byId(r, "ORL-0001").answerKey, undefined, "no invented key entry for 0001");
  assert.equal(r.report.key.questionsWithoutKeyEntry, 1);
});

test("section headings with declared counts are tracked; front-matter headings are reported separately", () => {
  const r = parse(["Monophthongs (12)", "Consonant sounds (2)", "ORL-0001 a", "A. x", "B. y", "Answer: A", "Source: s", "ORL-0002 b", "A. x", "B. y", "Answer: A", "Source: s"]);
  assert.deepEqual(r.report.sections.map((s) => [s.name, s.declared, s.found]), [["Consonant sounds", 2, 2]]);
  assert.equal(r.report.frontMatterHeadings.length, 1);
});

test("duplicate = same stem AND same option set; same stem with different options is not a duplicate", () => {
  const same = parse(["ORL-0001 stem", "A. a", "B. b", "Answer: A", "Source: s", "ORL-0002 stem", "A. b", "B. a", "Answer: B", "Source: s"]);
  assert.ok(byId(same, "ORL-0001").issues.some((i) => i.code === "DUPLICATE"));
  const diff = parse(["ORL-0001 stem", "A. a", "B. b", "Answer: A", "Source: s", "ORL-0002 stem", "A. a", "B. c", "Answer: A", "Source: s"]);
  assert.ok(!byId(diff, "ORL-0001").issues.some((i) => i.code === "DUPLICATE"));
});

test("fingerprint is science-safe: NFKC folds sub/superscripts, Co vs CO and Na vs NA stay different", () => {
  assert.equal(normaliseForFingerprint("H₂SO₄"), "H2SO4");
  assert.equal(normaliseForFingerprint("Fe³⁺"), "Fe3+");
  assert.notEqual(questionFingerprint("Identify Co", ["x"]), questionFingerprint("Identify CO", ["x"]));
  assert.notEqual(normaliseForFingerprint("2 + 3 = 5"), normaliseForFingerprint("2 - 3 = 5"));
});

test("UNDERLINE flag fires on detached fragments but not on ordinary one-word or sentence stems", () => {
  const r = parse(["ORL-0040 f oot", "A. a", "B. b", "Answer: A", "Source: s", "ORL-0041 film", "A. a", "B. b", "Answer: A", "Source: s", "ORL-0042 Titi went to ABUJA", "A. a", "B. b", "Answer: A", "Source: s"]);
  assert.ok(byId(r, "ORL-0040").issues.some((i) => i.code === "UNDERLINE"));
  assert.ok(!byId(r, "ORL-0041").issues.some((i) => i.code === "UNDERLINE"));
  assert.ok(!byId(r, "ORL-0042").issues.some((i) => i.code === "UNDERLINE"));
});

test("every code the importer source can emit has a plain-language explanation", () => {
  const src = ["idParser.js", "pdfReader.js"].map((f) => fs.readFileSync(new URL(`../../src/lib/import/${f}`, import.meta.url), "utf8")).join("\n");
  const emitted = new Set([...src.matchAll(/add\("([A-Z_]+)"/g), ...src.matchAll(/code:\s*"([A-Z_]+)"/g)].map((m) => m[1]));
  assert.ok(emitted.size >= 10);
  for (const c of emitted) assert.ok(CODE_INFO[c] && CODE_INFO[c].explain.length > 30, `code ${c} needs an explanation`);
  for (const [c, info] of Object.entries(CODE_INFO)) assert.ok(info.title && info.explain && info.severity && info.state, `${c} incomplete`);
});
