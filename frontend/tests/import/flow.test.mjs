import test from "node:test";
import assert from "node:assert/strict";
import { rowsToQuestions } from "../../src/lib/import/sheetImport.js";
import { parseCsv } from "../../src/lib/import/csv.js";
import { splitInlineOptions, parseTextQuestions, parseQuestionBlock } from "../../src/lib/import/textParser.js";
import { guessColumns, detectLegacyLayout } from "../../src/lib/import/columns.js";
import { sanitizeHtml } from "../../src/lib/import/html.js";
import { FILTERS, filterQuestions, summarise, applyCorrection, recheckAll, canSelect, defaultSelection, buildItems, stampUids, templateCsv } from "../../src/lib/import/importFlow.js";
import { makeBatches, runImport, toServerItem } from "../../src/lib/import/importPipeline.js";
import { CODE_INFO } from "../../src/lib/import/codes.js";
import fs from "node:fs";

const H = ["Question_ID", "Subject", "Topic", "Question", "Option_A", "Option_B", "Option_C", "Option_D", "Option_E", "Option_F", "Correct_Answer", "Explanation", "Source_Reference", "Source_Page", "Question_Type", "Review_Status", "Review_Notes", "Explanation_Source", "Image_Reference", "Source_Label"];
const row = (o) => H.map((h) => o[h] ?? "");
const R = (n, over = {}) => row({ Question_ID: `T-${n}`, Subject: "Physics", Topic: "Motion", Question: `Question number ${n}?`, Option_A: "a", Option_B: "b", Option_C: "c", Option_D: "d", Correct_Answer: "B", Explanation: "Because.", ...over });
const load = (rows) => stampUids(rowsToQuestions([H, ...rows]).questions);

test("headers are matched case-, space- and underscore-insensitively, and six options (A-F) are read", () => {
  const rows = [["question id", "SUBJECT", "Topic", "Question Text", "option a", "Option-B", "OptionC", "D", "Option_E", "option_f", "correct answer"], ["X1", "Bio", "Cells", "Which?", "a", "b", "c", "d", "e", "f", "F"]];
  const r = rowsToQuestions(rows);
  assert.equal(r.questions[0].options.length, 6);
  assert.equal(r.questions[0].correctKey, "F");
  assert.equal(r.questions[0].state, "ready_partial");
  assert.equal(r.questions[0].externalId, "X1");
});

test("any subject works: the subject comes from the file; columns the importer does not know are kept, not dropped", () => {
  const rows = [[...H, "Reviewer_Initials"], [...R(1, { Subject: "Economics" }), "TB"]];
  const q = rowsToQuestions(rows).questions[0];
  assert.equal(q.subject, "Economics"); assert.deepEqual(q.extra, { Reviewer_Initials: "TB" });
});

test("a Difficulty column is read as the question's difficulty (not parked in extra) and sent to the server", () => {
  const rows = [[...H, "Difficulty"], [...R(1), "Hard"], [...R(2), "Moderate"], [...R(3), ""]];
  const qs = rowsToQuestions(rows).questions;
  assert.deepEqual(qs.map((q) => q.difficulty), ["Hard", "Moderate", undefined]);
  assert.equal(qs[0].extra, undefined);
  assert.equal(toServerItem(qs[0]).difficulty, "Hard"); assert.equal(toServerItem(qs[2]).difficulty, "");
});

test("validation: missing answer, answer pointing at an empty option, too few options, empty text, bad marks", () => {
  const qs = load([R(1, { Correct_Answer: "" }), R(2, { Correct_Answer: "E" }), R(3, { Option_B: "", Option_C: "", Option_D: "" }), R(4, { Question: "" }), R(5, { Correct_Answer: "A,B" }), R(6, { Correct_Answer: "5" })]);
  const codes = (q) => q.issues.map((i) => i.code);
  assert.ok(codes(qs[0]).includes("NO_ANSWER") && qs[0].state === "missing_answer");
  assert.ok(codes(qs[1]).includes("BAD_ANSWER") && qs[1].state === "invalid_options");
  assert.ok(codes(qs[2]).includes("FEW_OPTIONS"));
  assert.ok(codes(qs[3]).includes("NO_TEXT") && qs[3].state === "incomplete");
  assert.ok(codes(qs[4]).includes("MULTI") && !qs[4].correctKey);
  assert.ok(codes(qs[5]).includes("NO_ANSWER") && !qs[5].correctKey, "a bare number is never read as a letter");
  assert.ok(qs.every((q) => !q.importable));
});

test("duplicates: exact copy is flagged, a near copy is 'likely', and the same stem with different options is just a repeated stem", () => {
  const qs = load([R(1), R(2), R(3, { Question: "Question number 1?", Option_D: "z" }), R(4, { Question: "Question number 1?", Option_A: "p", Option_B: "q", Option_C: "r", Option_D: "s" })]);
  const code = (q, c) => q.issues.some((i) => i.code === c);
  const first = qs.filter((q) => q.text === "Question number 1?" || q.text === "Question number 2?");
  assert.ok(first.length === 4);
  assert.ok(qs[0].text === "Question number 1?" && !code(qs[0], "DUPLICATE"));
  // T-1 and T-2 differ in wording ("1" vs "2") so neither is a duplicate; T-3 is the same stem with 3 of 4 options shared
  assert.ok(code(qs[2], "LIKELY_DUPLICATE") && code(qs[0], "LIKELY_DUPLICATE"));
  assert.ok(!code(qs[3], "DUPLICATE") && !code(qs[3], "LIKELY_DUPLICATE") && qs[3].repeatedStem);
  const exact = load([R(7), R(7, { Question_ID: "T-8" })]);
  assert.ok(exact.every((q) => code(q, "DUPLICATE")));
  const dupId = load([R(9), R(9, { Question: "Another one entirely?" })]);
  assert.ok(dupId.every((q) => code(q, "DUP_ID")));
});

test("source review status is kept as found; 'Needs Review' blocks 'ready', 'Verified' does not make us verified", () => {
  const qs = load([R(1, { Review_Status: "Needs Review", Review_Notes: "check units" }), R(2, { Review_Status: "Verified" }), R(3, { Review_Status: "Unverified" })]);
  assert.equal(qs[0].state, "needs_review"); assert.equal(qs[0].reviewNotes, "check units");
  assert.equal(qs[1].state, "ready"); assert.equal(qs[1].sourceStatus, "Verified");
  assert.equal(toServerItem(qs[1]).sourceStatus, "Verified");
});

test("diagram-dependent questions are never ready, with or without an image reference", () => {
  const qs = load([R(1, { Question_Type: "Multiple Choice (diagram-dependent)" }), R(2, { Question_Type: "Multiple Choice (diagram-dependent)", Image_Reference: "fig1.png" })]);
  assert.ok(qs.every((q) => q.state === "missing_visual" && !q.importable));
});

test("a header-less sheet is detected from the data, flagged as a guess, and the guess clears once the admin confirms it", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ["", "English", `<p>Pick the <u>odd</u> one ${i} in this sentence</p>`, "<p>x</p>", "<p>y</p>", "<p>z</p>", "<p>w</p>", "", "ABCD"[i % 4], i % 2 ? "<p>Because.</p>" : ""]);
  const d = detectLegacyLayout(rows);
  assert.equal(d.confidence, "high"); assert.deepEqual([d.fields.subject, d.fields.text, d.fields.correctKey, d.fields.explanation], [1, 2, 8, 9]);
  const r = rowsToQuestions(rows);
  assert.ok(r.report.needsMappingConfirmation && r.questions.every((q) => q.state === "needs_review"));
  assert.ok(r.questions[0].textHtml.includes("<u>odd</u>"));
  const ok = rowsToQuestions(rows, { mapping: d, mappingConfirmed: true });
  assert.ok(ok.questions.every((q) => !q.issues.some((i) => i.code === "COLUMNS_GUESSED")), "the guess flag clears once confirmed");
  assert.equal(ok.questions.filter((q) => q.importable).length, 8);
});

test("REGRESSION: a digit column (e.g. marks) to the right of the answers is never mistaken for the answer column when there is no header", () => {
  const rows = Array.from({ length: 6 }, (_, i) => [`This is the question text number ${i} with plenty of words`, "alpha", "beta", "gamma", "delta", "ABCD"[i % 4], "5"]);
  const g = guessColumns(rows);
  assert.equal(g.fields.correctKey, 5, "the letters column, not the digits column");
  assert.equal(g.guessed, true);
  assert.deepEqual(Object.values(g.options), [1, 2, 3, 4]);
});

test("REGRESSION: options all on one line under the question are split in order", () => {
  assert.deepEqual(splitInlineOptions("A. Earth  B. Jupiter  C. Mars  D. Venus", 0).map((o) => [o.key, o.text]), [["A", "Earth"], ["B", "Jupiter"], ["C", "Mars"], ["D", "Venus"]]);
  assert.equal(splitInlineOptions("Vitamin B. deficiency", 0), null);
  const { questions } = parseTextQuestions("1. Which planet is largest?\nA. Earth  B. Jupiter  C. Mars  D. Venus\nAnswer: B\n");
  assert.equal(questions[0].options.length, 4); assert.equal(questions[0].correctKey, "B");
});

test("REGRESSION: a whole question with its options in ONE cell is understood, and the answer column is applied afterwards", () => {
  const rows = [["Question", "Correct_Answer"], ["Which gas do plants absorb?\nA. Oxygen\nB. Carbon dioxide\nC. Nitrogen\nD. Helium", "B"]];
  const q = rowsToQuestions(rows).questions[0];
  assert.equal(q.text, "Which gas do plants absorb?"); assert.equal(q.options.length, 4); assert.equal(q.correctKey, "B"); assert.equal(q.state, "ready_partial");
});

test("text parser: sequence guard keeps '3. Hence' inside a stem; answer list at the end is applied but flagged", () => {
  const t = "1. The value is 5.\n3. Hence we conclude x.\nA. one\nB. two\nAnswer: A\n2. Next question?\nA. p\nB. q\n1-A 2-B 3-A\n";
  const { questions } = parseTextQuestions(t);
  assert.equal(questions.length, 2);
  assert.ok(questions[0].text.includes("3. Hence"));
  assert.ok(questions[1].issues.some((i) => i.code === "ANSWER_INFERRED") && questions[1].correctKey === "B");
});

test("CSV: quotes, doubled quotes, line breaks inside cells, and ; or tab delimiters", () => {
  assert.deepEqual(parseCsv('a,"b ""q"" c","line1\nline2"\n1,2,3').rows, [["a", 'b "q" c', "line1\nline2"], ["1", "2", "3"]]);
  assert.equal(parseCsv("a;b;c\n1;2;3").delimiter, ";"); assert.equal(parseCsv("a\tb\n1\t2").delimiter, "\t");
  const t = parseCsv(templateCsv()); assert.equal(t.rows[0].length, 21); assert.equal(t.rows[0][20], "Difficulty");
  assert.equal(rowsToQuestions(t.rows).questions[0].state, "ready");
});

test("corrections: filling in the missing answer makes a question importable; formatting is dropped only when the text is edited", () => {
  let qs = load([R(1, { Correct_Answer: "" }), R(2), R(3, { Question: "<p>See <u>this</u> word</p>" })]);
  assert.equal(qs[0].state, "missing_answer");
  qs[0] = applyCorrection(qs[0], { correctKey: "C" }); recheckAll(qs);
  assert.equal(qs[0].state, "ready"); assert.equal(qs[0].correctKey, "C"); assert.ok(qs[0].edited);
  assert.ok(qs[2].textHtml);
  const kept = applyCorrection(qs[2], { topic: "x" }); assert.ok(kept.textHtml);
  const lost = applyCorrection(qs[2], { text: "See this word now" }); assert.equal(lost.textHtml, undefined);
  const bad = applyCorrection(qs[1], { options: [{ key: "A", text: "only" }] }); assert.equal(bad.state, "invalid_options");
});

test("selection: ready by default; needs-review only once approved; incomplete only when the admin opts in; payload is built from that", () => {
  const qs = load([R(1), R(2, { Review_Status: "Needs Review" }), R(3, { Correct_Answer: "" })]);
  const sel = defaultSelection(qs);
  assert.deepEqual([...sel], [qs[0].uid], "only the ready question is selected by default");
  assert.equal(canSelect(qs[1], { allowIncomplete: false }), false);
  qs[1].approved = true; assert.equal(canSelect(qs[1], { allowIncomplete: false }), true);
  assert.equal(canSelect(qs[2], { allowIncomplete: false }), false); assert.equal(canSelect(qs[2], { allowIncomplete: true }), true);
  const all = new Set(qs.map((q) => q.uid));
  assert.equal(buildItems(qs, all, { allowIncomplete: false }).items.length, 2);
  const b = buildItems(qs, all, { allowIncomplete: true });
  assert.equal(b.items.length, 3);
  assert.equal(b.items[1].approved, true); assert.equal(b.items[1].reviewState, "needs_review");
});

test("filters and counts add up", () => {
  const qs = load([R(1), R(2, { Correct_Answer: "" }), R(3, { Question: "" }), R(4, { Option_B: "", Option_C: "", Option_D: "" }), R(5, { Explanation: "" })]);
  const s = summarise(qs);
  assert.deepEqual([s.total, s.ready, s.missingAnswer, s.incomplete, s.invalidOptions, s.noExplanation], [5, 2, 1, 1, 1, 1]);
  for (const f of FILTERS) assert.ok(filterQuestions(qs, f.id).length <= qs.length);
});

test("batches respect the item and size limits and keep order", () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({ externalId: `I${i}`, text: "x".repeat(1500) }));
  const b = makeBatches(items);
  assert.ok(b.every((x) => x.length <= 150 && JSON.stringify(x).length < 220 * 1024));
  assert.deepEqual(b.flat().map((x) => x.externalId), items.map((x) => x.externalId));
});

test("runImport: totals, offsets, cancel and resume (same session id) and a failure that can be retried", async () => {
  const items = Array.from({ length: 400 }, (_, i) => ({ externalId: `I${i}` }));
  const seen = new Set(); let calls = 0;
  const post = async (_p, body) => { calls++; let created = 0, unchanged = 0; for (const q of body.questions) { if (seen.has(q.externalId)) unchanged++; else { seen.add(q.externalId); created++; } } return { created, unchanged, updated: 0, conflicts: [], rejected: [{ index: 0, reason: "x" }] }; };
  const ac = new AbortController();
  const first = await runImport({ items, sessionId: "imp-abc-12345678", post, onProgress: (p) => { if (p.batch === 1) ac.abort(); }, signal: ac.signal });
  assert.equal(first.status, "cancelled"); assert.equal(first.nextBatch, 1);
  const rest = await runImport({ items, sessionId: "imp-abc-12345678", post, startBatch: first.nextBatch });
  assert.equal(rest.status, "done"); assert.equal(seen.size, 400);
  assert.equal(first.created + rest.created, 400);
  assert.equal(rest.rejected[0].index, 150, "indexes are file-wide, not per batch");
  const again = await runImport({ items, sessionId: "imp-abc-12345678", post });
  assert.deepEqual([again.created, again.unchanged], [0, 400]);
  let n = 0;
  const flaky = await runImport({ items, sessionId: "imp-zzz-12345678", post: async (p, b) => { if (++n === 2) throw new Error("offline"); return post(p, b); } });
  assert.deepEqual([flaky.status, flaky.nextBatch], ["failed", 1]);
});

test("every issue code the importer can emit has an explanation", () => {
  const src = ["textParser.js", "sheetImport.js", "validate.js", "importFlow.js", "pdfReader.js", "idParser.js"].map((f) => fs.readFileSync(new URL(`../../src/lib/import/${f}`, import.meta.url), "utf8")).join("\n");
  const used = new Set([...src.matchAll(/(?:issue|add)\("([A-Z_]+)"/g), ...src.matchAll(/code:\s*"([A-Z_]+)"/g)].map((m) => m[1]));
  for (const c of used) assert.ok(CODE_INFO[c], `${c} is missing from CODE_INFO`);
});
