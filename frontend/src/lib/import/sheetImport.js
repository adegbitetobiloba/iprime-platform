// Turns spreadsheet rows (from CSV or Excel) into question objects with issues, row by row.
// Preserves option order and letters, original IDs, source references and pages, review status and unmapped columns.
import { looksLikeHeader, mapHeaders, guessColumns, detectLegacyLayout, OPTION_LETTERS } from "./columns.js";
import { sanitizeHtml, htmlToText, looksLikeHtml } from "./html.js";
import { parseQuestionBlock } from "./textParser.js";
import { issue, finishQuestion, crossCheck, countBy } from "./validate.js";

const cell = (row, i) => (i === undefined ? "" : String(row[i] ?? "").trim());
// Formatted cells (HTML) keep their sanitised formatting; the plain text is derived from it. Plain cells are left exactly as they are.
const rich = (row, i) => {
  const raw = cell(row, i);
  if (!raw || !looksLikeHtml(raw)) return { text: raw };
  const html = sanitizeHtml(raw), text = htmlToText(html);
  return text ? { text, html } : { text: "" };
};
const same = (a, b) => a.normalize("NFKC").replace(/\s+/g, " ").trim() === b.normalize("NFKC").replace(/\s+/g, " ").trim();

// "b", "B.", "(C)", "Option D", "d)" -> letter. Option TEXT is accepted only if it matches exactly one option (and is flagged).
export function readAnswer(raw, options) {
  const v = String(raw ?? "").trim();
  if (!v) return { key: undefined };
  const m = v.match(/^(?:option|choice|answer)?\s*\(?([A-Fa-f])\)?\s*[.)]?$/i);
  if (m) return { key: m[1].toUpperCase() };
  if (/^[A-Fa-f]\s*[,&/;]\s*[A-Fa-f]\b/.test(v) || /^[A-Fa-f](?:\s+and\s+|\s+or\s+)[A-Fa-f]\b/i.test(v)) return { multi: true, note: v };
  const hits = options.filter((o) => o.text && same(o.text, v));
  if (hits.length === 1) return { key: hits[0].key, inferred: `The answer cell holds the text of option ${hits[0].key}.` };
  if (/^\d+$/.test(v)) return { note: `The answer "${v}" is a number, which is ambiguous (not read as a letter).` };
  return { note: `Could not read an answer from "${v.slice(0, 60)}".` };
}

export function rowsToQuestions(rows, ctx = {}) {
  const sheetName = ctx.sheetName || null;
  const hasHeaderRow = ctx.firstRowIsHeader !== undefined ? ctx.firstRowIsHeader : rows.length && looksLikeHeader(rows[0]);
  let mapping, body, firstDataRow;
  if (hasHeaderRow) { mapping = mapHeaders(rows[0]); body = rows.slice(1); firstDataRow = 2; }
  else { mapping = ctx.mapping || detectLegacyLayout(rows) || guessColumns(rows); body = rows; firstDataRow = 1; }
  if (hasHeaderRow && ctx.mapping) mapping = ctx.mapping;
  if (!mapping) return { questions: [], mapping: null, report: { error: "The columns could not be identified. Add a header row (for example: Question, Option A, Option B, Correct Answer).", rowsRead: rows.length } };
  if (!hasHeaderRow && mapping.guessed) mapping.unmapped = [];

  const F = mapping.fields, O = mapping.options;
  if (F.text === undefined && !Object.keys(O).length) return { questions: [], mapping, report: { error: "No question column was found.", rowsRead: rows.length } };

  const questions = [];
  let blankRows = 0;
  body.forEach((row, i) => {
    const excelRow = firstDataRow + i;
    if (!row.some((c) => String(c ?? "").trim() !== "")) { blankRows++; return; }
    const q = {
      externalId: cell(row, F.externalId) || undefined,
      subject: cell(row, F.subject) || ctx.subject || undefined,
      topic: cell(row, F.topic) || undefined, subtopic: cell(row, F.subtopic) || undefined,
      difficulty: cell(row, F.difficulty) || undefined,
      text: "", options: [], explanation: "",
      explanationSource: cell(row, F.explanationSource) || undefined,
      questionType: cell(row, F.questionType) || undefined, imageRef: cell(row, F.imageRef) || undefined,
      sourceRefs: cell(row, F.sourceReference) ? [cell(row, F.sourceReference)] : [], sourcePage: cell(row, F.sourcePage) || undefined, sourceLabel: cell(row, F.sourceLabel) || undefined,
      sourceReviewStatus: cell(row, F.reviewStatus) || undefined, sourceStatus: cell(row, F.reviewStatus) || undefined, reviewNotes: cell(row, F.reviewNotes) || undefined,
      issues: [], provenance: { sheet: sheetName, row: excelRow },
    };
    const tx = rich(row, F.text), ex = rich(row, F.explanation);
    q.text = tx.text; if (tx.html) q.textHtml = tx.html;
    q.explanation = ex.text; if (ex.html) q.explanationHtml = ex.html;
    if (cell(row, F.marks) !== "") { const n = Number(cell(row, F.marks)); q.marks = Number.isFinite(n) ? n : cell(row, F.marks); }
    if (F.originalNumber !== undefined && cell(row, F.originalNumber)) q.originalNumber = cell(row, F.originalNumber);

    // options, keeping the original letters and order; a gap before the last filled option is reported, not closed up
    const present = OPTION_LETTERS.filter((L) => O[L] !== undefined);
    const filledLetters = present.filter((L) => cell(row, O[L]) !== "");
    const lastIdx = filledLetters.length ? OPTION_LETTERS.indexOf(filledLetters[filledLetters.length - 1]) : -1;
    for (const L of present) if (OPTION_LETTERS.indexOf(L) <= lastIdx) { const o = rich(row, O[L]); q.options.push({ key: L, text: o.text, ...(o.html ? { html: o.html } : {}) }); }

    // whole question (stem + options) in ONE cell: the first line is the stem, the answer column is applied afterwards
    let blockAnswer;
    if (q.options.length === 0 && /\n/.test(q.text)) {
      const parsed = parseQuestionBlock(q.text).questions[0];
      if (parsed && parsed.options.length >= 2) {
        q.text = parsed.text; delete q.textHtml; q.options = parsed.options; if (!q.explanation && parsed.explanation) q.explanation = parsed.explanation;
        blockAnswer = parsed.correctKey;
        q.issues.push(...parsed.issues.filter((x) => ["ANSWER_INFERRED", "MULTI", "KEY_CONFLICT", "EXTRA_TEXT"].includes(x.code)));
        q.provenance.splitFromOneCell = true;
      }
    }

    // answer
    const a = readAnswer(cell(row, F.correctKey), q.options);
    if (a.multi) { q.issues.push(issue("MULTI", a.note)); q.answerNote = "Several answers were given."; }
    else if (a.key) {
      q.correctKey = a.key;
      if (a.inferred) q.issues.push(issue("ANSWER_INFERRED", a.inferred));
      if (blockAnswer && blockAnswer !== a.key) q.issues.push(issue("KEY_CONFLICT", `The question text says ${blockAnswer}, the answer column says ${a.key}.`));
    } else if (blockAnswer) q.correctKey = blockAnswer;
    else q.answerNote = a.note;

    if (/^needs?\s*review/i.test(q.sourceReviewStatus || "")) q.issues.push(issue("SOURCE_FLAG", `Review status in the file: ${q.sourceReviewStatus}${q.reviewNotes ? ` (${q.reviewNotes.slice(0, 120)})` : ""}`));
    if (mapping.guessed && !ctx.mappingConfirmed) q.issues.push(issue("COLUMNS_GUESSED", "Confirm the column mapping to clear this."));

    // columns we do not recognise are kept as found
    const extra = {};
    for (const u of mapping.unmapped) { const v = cell(row, u.index); if (v !== "") extra[u.name] = v.length > 500 ? v.slice(0, 500) : v; }
    if (q.originalNumber) extra["Original number"] = q.originalNumber;
    if (Object.keys(extra).length) q.extra = Object.fromEntries(Object.entries(extra).slice(0, 30));
    finishQuestion(q);
    questions.push(q);
  });
  crossCheck(questions);

  // Passages shared by several questions: kept inside each question (the question follows the passage in the same cell, and the
  // boundary cannot be found reliably), but grouped here so the administrator can see which questions belong together.
  const groups = new Map();
  for (const q of questions) if (q.text.length > 300) { const k = q.text.normalize("NFKC").replace(/\s+/g, " ").slice(0, 120); (groups.get(k) || groups.set(k, []).get(k)).push(q); }
  let sharedGroups = 0, sharedQuestions = 0;
  [...groups.values()].forEach((g, gi) => { if (g.length > 1) { sharedGroups++; sharedQuestions += g.length; g.forEach((q) => { q.sharedPassage = { group: gi + 1, size: g.length }; }); } });

  return {
    questions, mapping,
    report: {
      rowsRead: rows.length, headerRow: !!hasHeaderRow, dataRows: body.length, blankRows, questions: questions.length,
      byState: countBy(questions, (q) => q.state), importable: questions.filter((q) => q.importable).length,
      issueCounts: countBy(questions.flatMap((q) => q.issues), (x) => x.code),
      guessedColumns: !!mapping.guessed, mappingConfidence: mapping.confidence || null, mappingSummary: mapping.summary || null, needsMappingConfirmation: !!mapping.guessed && !ctx.mappingConfirmed,
      sharedPassages: { groups: sharedGroups, questions: sharedQuestions }, repeatedStems: questions.filter((q) => q.repeatedStem).length,
      withFormatting: questions.filter((q) => q.textHtml).length, missingExplanation: questions.filter((q) => !q.explanation).length, unmappedColumns: mapping.unmapped.map((u) => u.name), duplicateHeaders: mapping.duplicates,
      sourceReviewStatus: countBy(questions, (q) => q.sourceReviewStatus || "(none)"),
    },
  };
}
