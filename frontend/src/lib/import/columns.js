// Works out which spreadsheet column holds what. Header names are normalised (case, spaces, "_" and "-" ignored).
export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const norm = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const SYN = {
  externalId: ["questionid", "qid", "id", "itemid", "questioncode", "code"],
  originalNumber: ["questionno", "questionnumber", "qno", "no", "number", "sn", "sno", "serialno", "sno"],
  text: ["question", "questiontext", "text", "stem", "questionstem", "item"],
  correctKey: ["correctanswer", "answer", "correctoption", "correctchoice", "ans", "key", "correct", "answerkey", "rightanswer"],
  explanation: ["explanation", "solution", "rationale", "reason", "workedsolution"],
  explanationSource: ["explanationsource"],
  subject: ["subject"], topic: ["topic", "topictitle"], subtopic: ["subtopic"],
  marks: ["marks", "mark", "points", "score"],
  difficulty: ["difficulty", "difficultylevel"],
  questionType: ["questiontype", "type"],
  reviewStatus: ["reviewstatus", "status"],
  reviewNotes: ["reviewnotes", "notes", "note", "comments", "comment"],
  sourceReference: ["sourcereference", "sourceref", "reference", "source", "sourceid"],
  sourcePage: ["sourcepage", "page", "pageno", "pagenumber"],
  sourceLabel: ["sourcelabel", "label"],
  imageRef: ["imagereference", "image", "imageref", "imagefile", "figure"],
};
const LOOKUP = new Map();
for (const [field, names] of Object.entries(SYN)) for (const n of names) if (!LOOKUP.has(n)) LOOKUP.set(n, field);
const optionLetterOf = (n) => {
  let m = n.match(/^(?:option|choice|opt)?([a-f])$/);
  if (m) return m[1].toUpperCase();
  m = n.match(/^(?:option|choice|opt)([1-6])$/);
  return m ? OPTION_LETTERS[Number(m[1]) - 1] : null;
};

export function fieldOfHeader(h) {
  const n = norm(h);
  if (!n) return null;
  const letter = optionLetterOf(n);
  if (letter) return { option: letter };
  return LOOKUP.has(n) ? { field: LOOKUP.get(n) } : null;
}

export function looksLikeHeader(row) {
  const hits = row.filter((c) => String(c).length < 40 && fieldOfHeader(c)).length;
  return hits >= 2 && row.some((c) => { const f = fieldOfHeader(c); return f && (f.field === "text" || f.option); });
}

export function mapHeaders(header) {
  const fields = {}, options = {}, unmapped = [], duplicates = [];
  header.forEach((h, index) => {
    const f = fieldOfHeader(h);
    if (!f) { if (String(h ?? "").trim()) unmapped.push({ index, name: String(h).trim() }); return; }
    if (f.option) { if (options[f.option] !== undefined) duplicates.push(String(h)); else options[f.option] = index; }
    else if (fields[f.field] !== undefined) duplicates.push(String(h));
    else fields[f.field] = index;
  });
  return { fields, options, unmapped, duplicates, guessed: false, hasHeader: true };
}

const isLetter = (v) => /^[A-Fa-f]$/.test(String(v).trim());
// No header row: the answer column is the right-most column whose non-empty values are ALL single letters A-F
// (a digit, which also looks "short", must never be mistaken for an answer). Returns null when it cannot be done safely.
export function guessColumns(rows) {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const col = (i) => rows.map((r) => String(r[i] ?? "").trim()).filter(Boolean);
  let answer = -1;
  for (let i = width - 1; i >= 0; i--) {
    const v = col(i);
    if (v.length >= Math.max(3, Math.floor(rows.length * 0.5)) && v.every(isLetter)) { answer = i; break; }
  }
  if (answer < 1) return null;
  const median = (arr) => { const a = arr.map((x) => x.length).sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
  let text = -1;
  for (let i = 0; i < answer; i++) if (median(col(i)) >= 15) { text = i; break; }
  if (text < 0) return null;
  const optCols = [];
  for (let i = text + 1; i < answer && optCols.length < 6; i++) if (col(i).length) optCols.push(i);
  if (optCols.length < 2) return null;
  const options = {}; optCols.forEach((c, k) => { options[OPTION_LETTERS[k]] = c; });
  return { fields: { text, correctKey: answer }, options, unmapped: [], duplicates: [], guessed: true, hasHeader: false };
}

export const colLetter = (i) => { let n = i + 1, out = ""; while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); } return out; };

// Legacy workbooks without a header row (e.g. "English 13th Mock"): [blank] [Subject] [Question] [Option A..D] [blank] [Answer] [Explanation].
// Works from the data: the answer column is the right-most column of single letters; the options are the filled columns
// just left of it (blank columns are skipped); the question is the longest-text column among them; a short, repetitive column
// to its left is the subject; the first filled column right of the answer is the explanation. Returns a confidence so the
// administrator can be asked to confirm the mapping.
export function detectLegacyLayout(rows) {
  const data = rows.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (data.length < 3) return null;
  const width = Math.max(...data.map((r) => r.length));
  const vals = (i) => data.map((r) => String(r[i] ?? "").trim());
  const filled = (i) => vals(i).filter(Boolean);
  const share = (i) => filled(i).length / data.length;
  let answer = -1;
  for (let i = width - 1; i >= 0; i--) { const f = filled(i); if (share(i) >= 0.6 && f.every(isLetter)) { answer = i; break; } }
  if (answer < 1) return null;
  const cand = []; for (let i = 0; i < answer; i++) if (share(i) >= 0.6) cand.push(i);
  if (cand.length < 3) return null;
  const med = (i) => { const a = filled(i).map((x) => x.replace(/<[^>]*>/g, "").length).sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
  const textCol = cand.reduce((best, i) => (med(i) > med(best) ? i : best), cand[0]);
  const optionCols = cand.filter((i) => i > textCol).slice(0, 6);
  if (optionCols.length < 2) return null;
  const left = cand.filter((i) => i < textCol);
  const distinct = (i) => new Set(filled(i)).size;
  const subjectCol = left.length ? left[left.length - 1] : undefined;
  const subject = subjectCol !== undefined && distinct(subjectCol) <= Math.max(6, data.length * 0.2) && med(subjectCol) <= 40 ? subjectCol : undefined;
  let explanation; for (let i = answer + 1; i < width; i++) if (filled(i).length) { explanation = i; break; }
  const options = {}; optionCols.forEach((c, k) => { options[OPTION_LETTERS[k]] = c; });
  const fields = { text: textCol, correctKey: answer };
  if (subject !== undefined) fields.subject = subject;
  if (explanation !== undefined) fields.explanation = explanation;
  const complete = data.filter((r) => String(r[answer] ?? "").trim() && optionCols.filter((c) => String(r[c] ?? "").trim()).length >= 2 && String(r[textCol] ?? "").trim()).length / data.length;
  const lines = [`Column ${colLetter(textCol)} -> Question`, ...optionCols.map((c, k) => `Column ${colLetter(c)} -> Option ${OPTION_LETTERS[k]}`), `Column ${colLetter(answer)} -> Correct answer`];
  if (subject !== undefined) lines.unshift(`Column ${colLetter(subject)} -> Subject`);
  if (explanation !== undefined) lines.push(`Column ${colLetter(explanation)} -> Explanation`);
  return { fields, options, unmapped: [], duplicates: [], guessed: true, hasHeader: false, confidence: complete >= 0.9 && optionCols.length >= 3 ? "high" : "low", summary: lines, completeRows: Math.round(complete * 100) };
}
