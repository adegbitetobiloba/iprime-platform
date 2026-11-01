// Logic behind the import screen (no React), so it can be tested: filters, counts, corrections, selection, and the upload payload.
import { checkQuestion, finishQuestion, crossCheck, issue } from "./validate.js";
import { stateFromIssues, IMPORTABLE_STATES } from "./codes.js";
import { toServerItem } from "./importPipeline.js";

// Checks that are recomputed after every correction. Everything else (source flags, guessed columns...) is kept.
const RECOMPUTED = new Set(["NO_TEXT", "EMPTY_OPTION", "FEW_OPTIONS", "DUP_OPTION", "NO_ANSWER", "BAD_ANSWER", "BAD_MARKS", "TOO_LONG", "VISUAL", "IMAGE", "MATH", "DUPLICATE", "LIKELY_DUPLICATE", "DUP_ID"]);

export const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "ready", label: "Ready", test: (q) => IMPORTABLE_STATES.has(q.state) },
  { id: "needs_review", label: "Needs review", test: (q) => q.state === "needs_review" || q.state === "conflicting_answer" },
  { id: "missing_answer", label: "Missing answer", test: (q) => q.state === "missing_answer" || hasCode(q, "NO_ANSWER") },
  { id: "invalid_options", label: "Invalid options", test: (q) => q.state === "invalid_options" },
  { id: "incomplete", label: "Incomplete", test: (q) => q.state === "incomplete" || hasCode(q, "NO_TEXT") },
  { id: "duplicates", label: "Duplicates", test: (q) => hasCode(q, "DUPLICATE") || hasCode(q, "LIKELY_DUPLICATE") || hasCode(q, "DUP_ID") },
  { id: "visual", label: "Needs a diagram", test: (q) => q.state === "missing_visual" || hasCode(q, "VISUAL") || hasCode(q, "IMAGE") },
  { id: "no_explanation", label: "No explanation", test: (q) => !q.explanation },
];
export function hasCode(q, code) { return (q.issues || []).some((i) => i.code === code); }
export const filterQuestions = (list, id) => { const f = FILTERS.find((x) => x.id === id) || FILTERS[0]; return list.filter(f.test); };

export function summarise(list) {
  const count = (id) => filterQuestions(list, id).length;
  return {
    total: list.length, ready: count("ready"), needsReview: count("needs_review"), missingAnswer: count("missing_answer"), invalidOptions: count("invalid_options"),
    incomplete: count("incomplete"), duplicates: count("duplicates"), visual: count("visual"), noExplanation: count("no_explanation"),
  };
}

// The administrator's corrections. Returns a NEW question, with every check recomputed. Editing plain text drops old formatting.
export function applyCorrection(q, patch) {
  const next = { ...q, options: (q.options || []).map((o) => ({ ...o })) };
  if (patch.text !== undefined && patch.text !== q.text) { next.text = patch.text.trim(); delete next.textHtml; }
  if (patch.explanation !== undefined && patch.explanation !== q.explanation) { next.explanation = patch.explanation.trim(); delete next.explanationHtml; }
  for (const k of ["subject", "topic", "subtopic", "questionType", "imageRef"]) if (patch[k] !== undefined) next[k] = patch[k].trim() || undefined;
  if (patch.marks !== undefined) next.marks = patch.marks === "" ? undefined : Number(patch.marks);
  if (patch.correctKey !== undefined) { next.correctKey = patch.correctKey || undefined; next.answerNote = undefined; }
  if (patch.options) {
    next.options = patch.options.filter((o) => o && o.key).map((o) => {
      const old = (q.options || []).find((x) => x.key === o.key);
      const text = (o.text ?? "").trim();
      return old && old.html && old.text === text ? { key: o.key, text, html: old.html } : { key: o.key, text };
    });
  }
  next.edited = true;
  // keep what the importer noted about the source; drop the checks that are recomputed below
  next.issues = (q.issues || []).filter((i) => !RECOMPUTED.has(i.code) && !(i.code === "ANSWER_INFERRED" && patch.correctKey !== undefined));
  return finishQuestion(next);
}

// Re-run the file-level checks (duplicates) after any change.
export function recheckAll(list) {
  for (const q of list) {
    q.issues = (q.issues || []).filter((i) => !["DUPLICATE", "LIKELY_DUPLICATE", "DUP_ID"].includes(i.code));
    q.state = stateFromIssues(q.issues, { hasExplanation: !!q.explanation });
    q.importable = IMPORTABLE_STATES.has(q.state);
    q.repeatedStem = false;
  }
  return crossCheck(list);
}

export const isIncompleteState = (s) => ["missing_answer", "invalid_options", "incomplete", "missing_visual", "extraction_failure"].includes(s);

// Can this question be sent? Ready ones always; "needs review" ones only once approved; incomplete ones only when the
// administrator chose to keep incomplete questions in the bank for later correction (the server re-checks all of this).
export function canSelect(q, { allowIncomplete }) {
  if (q.importable) return true;
  if (isIncompleteState(q.state)) return !!allowIncomplete;
  return !!q.approved;
}

export const defaultSelection = (list) => new Set(list.filter((q) => q.importable).map((q) => q.uid));

export function buildItems(list, selected, { allowIncomplete }) {
  const items = [], leftOut = [];
  for (const q of list) {
    if (!selected.has(q.uid)) continue;
    if (!canSelect(q, { allowIncomplete })) { leftOut.push(q); continue; }
    const dupe = (q.issues || []).some((i) => i.code === "DUPLICATE" || i.code === "LIKELY_DUPLICATE");
    items.push(toServerItem(q, { approved: !!q.approved || q.importable, skipIfDuplicate: false }));
    if (dupe && !q.approved && !q.importable) leftOut.push(q);
  }
  return { items, leftOut };
}

export const stampUids = (questions) => questions.map((q, i) => ({ ...q, uid: q.provenance?.row ?? q.provenance?.number ?? i + 1 }));

// Plain-language label for a state or problem code (the code explanations live in codes.js).
export const PROBLEM_LABELS = {
  NO_TEXT: "Missing question text", FEW_OPTIONS: "Fewer than 2 options", EMPTY_OPTION: "Empty option", DUP_KEY: "Repeated option letter", NO_ANSWER: "Missing answer",
  BAD_ANSWER: "Answer is not an option", BAD_MARKS: "Invalid marks", TOO_LONG: "Too long", VISUAL: "Needs a diagram",
};

export function templateCsv() {
  const head = ["Question_ID", "Subject", "Topic", "Question", "Option_A", "Option_B", "Option_C", "Option_D", "Option_E", "Option_F", "Correct_Answer", "Explanation", "Source_Reference", "Source_Page", "Question_Type", "Review_Status", "Review_Notes", "Explanation_Source", "Image_Reference", "Source_Label", "Difficulty"];
  const ex = ["CHM-0001", "Chemistry", "Atomic structure", "What is the charge of a proton?", "Positive", "Negative", "Neutral", "Variable", "", "", "A", "A proton carries a positive charge.", "Textbook p. 12", "12", "Multiple Choice", "Unverified", "", "Extracted from source", "", "Part 1", "Easy"];
  const q = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return `${head.join(",")}\n${ex.map(q).join(",")}\n`;
}
