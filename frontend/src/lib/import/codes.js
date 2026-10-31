// Issue codes emitted by the importers, with plain-language explanations for admins.
// A test asserts that every code the parsers can emit is listed here.
export const SEVERITY = { ERROR: "error", WARNING: "warning" };

export const CODE_INFO = {
  NO_TEXT:        { severity: "error",   state: "incomplete",      title: "No question text",          explain: "The question has no text. The source may have lost it during extraction. It was not guessed or filled in, so an admin needs to supply it from the original document." },
  FEW_OPTIONS:    { severity: "error",   state: "invalid_options", title: "Fewer than two options",    explain: "A question needs at least two answer options. Fewer were found, so the options may be missing or were not recognised." },
  EMPTY_OPTION:   { severity: "error",   state: "invalid_options", title: "Empty option",              explain: "One of the options has a label but no text. Check the source and fill it in." },
  NO_ANSWER:      { severity: "error",   state: "missing_answer",  title: "No answer given",           explain: "No correct answer could be read for this question. It cannot be imported until an admin confirms the answer from the source." },
  BAD_ANSWER:     { severity: "error",   state: "invalid_options", title: "Answer does not match an option", explain: "The answer letter does not correspond to any option that exists for this question, for example the answer is E but there are only four options." },
  BAD_MARKS:      { severity: "error",   state: "invalid_options", title: "Invalid marks",             explain: "The marks value is not a valid number in the allowed range." },
  TOO_LONG:       { severity: "error",   state: "invalid_options", title: "Text too long",             explain: "The question, an option or the explanation is longer than the platform allows. It may be several questions merged together." },
  EXTRACTION:     { severity: "error",   state: "extraction_failure", title: "Extraction failed",      explain: "Text could not be read from this part of the file (for example a scanned page that needs OCR, which is not supported). Nothing was guessed." },

  DUP_OPTION:     { severity: "warning", state: "needs_review",    title: "Two identical options",     explain: "Two options have the same text. Check the source: one may have been mis-copied." },
  ANSWER_INFERRED:{ severity: "warning", state: "needs_review",    title: "Answer inferred",           explain: "The answer was not stated outright and was taken from a marker such as a tick, star or highlight. Please confirm it." },
  KEY_CONFLICT:   { severity: "warning", state: "conflicting_answer", title: "Answers disagree",       explain: "The answer given with the question differs from the answer in the separate answer key. Both are kept; an admin must decide which is right." },
  KEY_CORRECTED:  { severity: "warning", state: "needs_review",    title: "Source answer was corrected", explain: "The document says its original answer key was changed by an editor. The original key is kept alongside the corrected one. Please confirm the corrected answer." },
  SOURCE_FLAG:    { severity: "warning", state: "needs_review",    title: "Flagged by the source",     explain: "The source document itself marked this question for verification (for example VERIFY or SOURCES DISAGREE). Please review it." },
  INCOMPLETE:     { severity: "warning", state: "incomplete",      title: "Question looks incomplete", explain: "The source marks this question as incomplete (for example STEM INCOMPLETE). It must be completed before it can be used." },
  EXTRA_TEXT:     { severity: "warning", state: "needs_review",    title: "Unexpected extra text",     explain: "Some text did not fit the expected layout (for example an option out of order). It was kept with the question rather than dropped. Please check it." },
  MULTI:          { severity: "warning", state: "needs_review",    title: "More than one answer",      explain: "More than one answer letter was found. The platform supports a single correct answer, so none was chosen automatically." },
  MATH:           { severity: "warning", state: "ready",           title: "Contains formulae or symbols", explain: "The text contains chemical, mathematical or special notation. It was kept exactly as extracted, but garbled symbols cannot be detected automatically, so a quick visual check against the source is advisable." },
  IMAGE:          { severity: "warning", state: "needs_review",    title: "Mentions an image or figure", explain: "The wording mentions a picture, figure, graph or table, but the file does not say the question depends on a diagram. Images are not imported, so check that the question can be answered without one, then approve it." },
  VISUAL:         { severity: "warning", state: "missing_visual",  title: "Depends on a diagram or table", explain: "The wording suggests a diagram, graph or table is needed. Diagram support is not available yet, so this question is not marked ready." },
  UNDERLINE:      { severity: "warning", state: "needs_review",    title: "Underlined letters may be lost", explain: "Many questions ask about the underlined letters of a word, but underlining does not survive extraction. The word shows spaces where the underline was (for example 'f oot'). The text is kept as found; check it against the original." },
  DUPLICATE:      { severity: "warning", state: "possible_duplicate", title: "Possible duplicate",     explain: "Another question has the same wording and the same set of options. Questions with the same wording but different options are not treated as duplicates." },
  COLUMNS_GUESSED:{ severity: "warning", state: "needs_review",    title: "Columns were guessed",     explain: "The file has no header row, so the question, option and answer columns were worked out from the data. Please check that they were read correctly before importing." },
  LIKELY_DUPLICATE:{ severity: "warning", state: "possible_duplicate", title: "Likely duplicate",  explain: "Another question has the same wording and most of the same options, but not all of them. It may be a corrected copy. Both are kept; please compare them and decide." },
  DUP_ID:         { severity: "warning", state: "needs_review",    title: "Repeated question ID",      explain: "The same question ID appears more than once in the document. Both were kept; please check which is correct." },
};

export const EMITTABLE_CODES = Object.keys(CODE_INFO);

export const STATE_LABELS = {
  ready: "Ready",
  ready_partial: "Valid (optional details missing)",
  needs_review: "Needs review",
  missing_answer: "Missing answer",
  conflicting_answer: "Conflicting answer",
  invalid_options: "Invalid options",
  incomplete: "Incomplete",
  possible_duplicate: "Possible duplicate",
  missing_visual: "Missing visual",
  extraction_failure: "Extraction failure",
};

// Order matters: first match wins when a question has several problems.
const STATE_PRIORITY = ["extraction_failure", "missing_answer", "conflicting_answer", "invalid_options", "incomplete", "missing_visual", "possible_duplicate", "needs_review"];

export function stateFromIssues(issues, { hasExplanation = true } = {}) {
  const states = new Set(issues.map((i) => CODE_INFO[i.code]?.state).filter((s) => s && s !== "ready"));
  for (const s of STATE_PRIORITY) if (states.has(s)) return s;
  return hasExplanation ? "ready" : "ready_partial";
}

export const IMPORTABLE_STATES = new Set(["ready", "ready_partial"]);
