// Pure question-bank logic (no database), so it can be tested on its own.
const crypto = require("crypto");
const { OPTION_KEYS } = require("./cbt");
const { sanitizeHtml, htmlToText } = require("./html");

const LIMITS = { text: 4000, option: 1000, explanation: 4000, solution: 4000, marksMin: 0.5, marksMax: 100 };
const DIAGRAM_RE = /diagram/i;

const str = (v) => (v === null || v === undefined ? "" : String(v));
const squash = (v) => str(v).normalize("NFKC").replace(/\s+/g, " ").trim();   // for identity and duplicate detection (folds H₂O and H2O)
const tidy = (v) => str(v).replace(/\s+/g, " ").trim();                          // whitespace only: exact content, for change detection

const cleanOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .filter((o) => o && OPTION_KEYS.includes(str(o.key).toUpperCase()))
    .map((o) => ({ key: str(o.key).toUpperCase(), text: str(o.text).trim(), ...(o.html ? { html: str(o.html) } : {}) }))
    .sort((a, b) => a.key.localeCompare(b.key));

// What is wrong with this question? Empty list = it can be used in an examination.
// Nothing is guessed or filled in: a missing answer stays missing.
function problemsOf(q) {
  const out = [];
  const add = (code, message) => out.push({ code, message });
  const text = str(q.text).trim();
  const options = cleanOptions(q.options);
  const filled = options.filter((o) => o.text);
  const keys = options.map((o) => o.key);
  const correctKey = str(q.correctKey).toUpperCase();

  if (!text) add("NO_TEXT", "The question text is missing.");
  if (options.some((o) => !o.text)) add("EMPTY_OPTION", "An option has a letter but no text.");
  if (filled.length < 2) add("FEW_OPTIONS", "A question needs at least 2 options.");
  if (new Set(keys).size !== keys.length) add("DUP_KEY", "Two options use the same letter.");
  if (!correctKey) add("NO_ANSWER", "The correct answer is missing.");
  else if (!filled.some((o) => o.key === correctKey)) add("BAD_ANSWER", `The answer ${correctKey} is not one of the options.`);
  if (q.marks !== undefined && q.marks !== null && q.marks !== "") {
    const m = Number(q.marks);
    if (!Number.isFinite(m) || m < LIMITS.marksMin || m > LIMITS.marksMax) add("BAD_MARKS", `Marks must be between ${LIMITS.marksMin} and ${LIMITS.marksMax}.`);
  }
  if (text.length > LIMITS.text || options.some((o) => o.text.length > LIMITS.option) || str(q.explanation).length > LIMITS.explanation) add("TOO_LONG", "The question, an option or the explanation is too long.");
  // Diagram support is a later phase: even with an image reference the picture is not imported, so the question is never usable.
  if (DIAGRAM_RE.test(str(q.questionType))) add("VISUAL", str(q.imageRef).trim() ? "This question depends on a diagram that is not imported yet." : "This question depends on a diagram that has not been supplied.");
  return out;
}

const hasSolution = (q) => Boolean(str(q.solution && q.solution.text).trim() || str(q.explanation).trim());

// Flags stored on every bank question so lists can be filtered cheaply.
function completeness(q) {
  const problems = problemsOf(q);
  return { problems: problems.map((p) => p.code), usable: problems.length === 0, awaitingSolution: problems.length === 0 && !hasSolution(q) };
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Same wording + same options (any order) -> same stemHash. Case is kept on purpose (Co vs CO; stress banks).
const stemHashOf = (q) => sha([squash(q.text), ...cleanOptions(q.options).map((o) => squash(o.text)).sort()].join("\u241F"));

// Changes whenever any imported content changes, even H₂O -> H2O. Used to make re-imports idempotent.
const contentHashOf = (q) =>
  sha(JSON.stringify([
    tidy(q.externalId), tidy(q.subject), tidy(q.topic), tidy(q.subtopic), tidy(q.text),
    cleanOptions(q.options).map((o) => [o.key, tidy(o.text), tidy(o.html)]), str(q.correctKey).toUpperCase(),
    tidy(q.explanation), q.marks ?? null, tidy(q.questionType), tidy(q.imageRef), (q.sourceRefs || []).map(tidy),
    tidy(q.textHtml), tidy(q.explanationHtml), tidy(q.sourceStatus), tidy(q.sourcePage),
  ]));

// Stable identity: the question's own ID when it has one, otherwise a hash of its wording and options.
const externalKeyOf = (q) => (squash(q.externalId) ? squash(q.externalId) : `hash:${stemHashOf(q)}`);

// Turns one validated import item into the document stored in the bank, or reports why it cannot be.
// `approved` is the administrator's explicit OK for a question the importer marked "needs review".
// Formatted content is sanitised HERE, whatever the browser sent, and the plain text is derived from the sanitised HTML.
const fromHtml = (html, plain) => {
  const h = str(html).trim() ? sanitizeHtml(html) : "";
  const t = h ? htmlToText(h) : "";
  return t ? { html: h, text: t } : { html: undefined, text: h ? "" : str(plain).trim() };
};

// Accepts the common ways a sheet says it (Easy, MEDIUM, moderate, Hard, difficult, basic/intermediate/advanced). Anything else is left unset, never guessed.
const DIFFICULTY_WORDS = { easy: "easy", basic: "easy", simple: "easy", medium: "medium", moderate: "medium", intermediate: "medium", average: "medium", hard: "hard", difficult: "hard", advanced: "hard" };
const normDifficulty = (v) => DIFFICULTY_WORDS[String(v == null ? "" : v).trim().toLowerCase()] || undefined;

// A question's difficulty: the field if set, otherwise a "Difficulty" column an earlier import kept under `extra`. Never guessed.
const difficultyOf = (q) => normDifficulty(q.difficulty) || normDifficulty(q.extra && (q.extra.Difficulty || q.extra.difficulty || q.extra.Difficulty_Level)) || null;

function prepareImportItem(item, { allowIncomplete = false } = {}) {
  const tx = fromHtml(item.textHtml, item.text);
  const ex = fromHtml(item.explanationHtml, item.explanation);
  const base = {
    externalId: squash(item.externalId) || undefined,
    subject: squash(item.subject), topic: squash(item.topic), subtopic: squash(item.subtopic),
    text: tx.text, textHtml: tx.html,
    options: cleanOptions((item.options || []).map((o) => { const f = fromHtml(o.html, o.text); return { key: o.key, text: f.text, html: f.html }; })),
    correctKey: str(item.correctKey).toUpperCase() || undefined,
    explanation: ex.text, explanationHtml: ex.html,
    sourceStatus: squash(item.sourceStatus) || undefined,
    explanationSource: squash(item.explanationSource) || undefined,
    marks: item.marks === null || item.marks === undefined || item.marks === "" ? 1 : Number(item.marks),
    questionType: squash(item.questionType) || undefined,
    difficulty: normDifficulty(item.difficulty),
    imageRef: squash(item.imageRef) || undefined,
    source: { refs: (item.sourceRefs || []).map(squash).filter(Boolean), page: squash(item.sourcePage) || undefined, label: squash(item.sourceLabel) || undefined },
    extra: item.extra && typeof item.extra === "object" ? item.extra : undefined,
  };
  const c = completeness({ ...base });
  if (c.problems.length && !allowIncomplete) return { ok: false, reason: "invalid", problems: problemsOf(base) };
  const wanted = item.reviewState === "needs_review" ? "needs_review" : "ready";
  if (!c.problems.length && wanted === "needs_review" && item.approved !== true) {
    return { ok: false, reason: "needs_approval", problems: [{ code: "NEEDS_REVIEW", message: "The importer flagged this question for review. Approve it explicitly to import it." }] };
  }
  const status = c.problems.length ? "incomplete" : wanted === "needs_review" ? "approved" : "ready";
  return {
    ok: true,
    doc: {
      ...base,
      externalKey: externalKeyOf(base),
      contentHash: contentHashOf({ ...base, sourceRefs: base.source.refs }),
      stemHash: stemHashOf(base),
      usable: c.usable, problems: c.problems, awaitingSolution: c.awaitingSolution,
      review: { status, notes: squash(item.reviewNotes) || undefined, issues: (item.issues || []).slice(0, 20) },
    },
  };
}

// Fields an administrator may edit. Everything else is ignored.
const EDITABLE = ["subject", "topic", "subtopic", "text", "options", "correctKey", "explanation", "marks", "questionType", "imageRef", "difficulty"];

// Applies an administrator's edit to a plain bank-question object and recomputes every derived flag.
function applyEdit(current, patch, adminId, now = new Date()) {
  const next = { ...current };
  for (const k of EDITABLE) if (patch[k] !== undefined) next[k] = k === "options" ? cleanOptions(patch[k]) : patch[k];
  // Editing the plain text of something that had formatting removes that formatting (it would no longer match). The UI warns first.
  if (patch.text !== undefined && str(patch.text).trim() !== str(current.text).trim()) next.textHtml = undefined;
  if (patch.explanation !== undefined && str(patch.explanation).trim() !== str(current.explanation).trim()) next.explanationHtml = undefined;
  if (patch.options !== undefined) next.options = cleanOptions(patch.options).map((o) => { const old = (current.options || []).find((x) => x.key === o.key); return old && old.html && str(old.text).trim() === o.text ? { key: o.key, text: o.text, html: old.html } : { key: o.key, text: o.text }; });
  if (patch.difficulty !== undefined) next.difficulty = normDifficulty(patch.difficulty);
  if (patch.correctKey !== undefined) next.correctKey = str(patch.correctKey).toUpperCase() || undefined;
  if (patch.solutionText !== undefined) {
    const t = str(patch.solutionText).trim();
    // An admin-written solution is always labelled as such, with author and date; it is never shown as source-verified.
    next.solution = t ? { text: t, by: adminId, at: now, status: "admin_written" } : undefined;
  }
  const c = completeness(next);
  next.usable = c.usable; next.problems = c.problems; next.awaitingSolution = c.awaitingSolution;
  next.contentHash = contentHashOf({ ...next, sourceRefs: next.source && next.source.refs });
  next.stemHash = stemHashOf(next);
  next.review = { ...(next.review || {}), status: c.usable ? "approved" : "incomplete" };
  if (patch.reviewNotes !== undefined) next.review.notes = str(patch.reviewNotes).trim() || undefined;
  next.edited = true;
  next.version = (current.version || 1) + 1;
  next.updatedBy = adminId;
  return next;
}

// The snapshot copied into an exam. The exam keeps its own copy from then on.
function examSnapshot(q) {
  const adminSolution = q.solution && q.solution.text;
  const snap = {
    text: q.text, options: cleanOptions(q.options), correctKey: q.correctKey, marks: q.marks ?? 1,
    bankId: q._id, bankVersion: q.version || 1,
  };
  if (q.textHtml) snap.textHtml = q.textHtml;
  if (q.topic) snap.topic = String(q.topic).slice(0, 120);
  if (q.subject) snap.subject = String(q.subject).slice(0, 80);
  const diff = difficultyOf(q);
  if (diff) snap.difficulty = diff;
  const expl = adminSolution || q.explanation;
  if (expl) { snap.explanation = String(expl).slice(0, 4000); snap.explanationSource = adminSolution ? "admin_written" : "source"; if (!adminSolution && q.explanationHtml) snap.explanationHtml = q.explanationHtml; }
  return snap;
}

const escapeRegex = (s) => str(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// What changed between two versions of a question (for the audit trail). Long values are shortened.
const short = (v) => { const t = typeof v === "string" ? v : JSON.stringify(v ?? ""); return t.length > 200 ? `${t.slice(0, 200)}…` : t; };
function diffFields(before, after) {
  const out = [];
  for (const f of [...EDITABLE, "solution"]) {
    const a = f === "solution" ? before.solution && before.solution.text : before[f], b = f === "solution" ? after.solution && after.solution.text : after[f];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out.push({ field: f, from: short(a), to: short(b) });
  }
  return out;
}

module.exports = { difficultyOf, normDifficulty, diffFields, LIMITS, cleanOptions, problemsOf, completeness, hasSolution, stemHashOf, contentHashOf, externalKeyOf, prepareImportItem, applyEdit, examSnapshot, escapeRegex, EDITABLE };
