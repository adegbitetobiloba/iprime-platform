// File -> questions, and questions -> server in safe batches.
import { parseCsv } from "./csv.js";
import { readXlsx } from "./xlsxReader.js";
import { rowsToQuestions } from "./sheetImport.js";
import { parseTextQuestions } from "./textParser.js";
import { loadJsZip } from "./vendor.js";

export const MAX_SHEET_BYTES = 25 * 1024 * 1024;
export const BATCH_MAX_ITEMS = 150;
export const BATCH_MAX_BYTES = 220 * 1024; // the server accepts bodies up to 300 kB

export const kindOf = (name) => { const n = String(name || "").toLowerCase(); if (/\.(xlsx|xlsm)$/.test(n)) return "xlsx"; if (/\.(csv|tsv)$/.test(n)) return "csv"; if (/\.pdf$/.test(n)) return "pdf"; if (/\.(txt|text)$/.test(n)) return "text"; if (/\.xls$/.test(n)) return "xls"; if (/\.docx?$/.test(n)) return "word"; return "unknown"; };

export function checkFile(file) {
  const kind = kindOf(file?.name);
  if (!file) return { ok: false, message: "Choose a file first." };
  if (file.size === 0) return { ok: false, message: "The file is empty." };
  if (kind === "xls") return { ok: false, message: "Old .xls files are not supported. Open it in Excel and save it as .xlsx or .csv." };
  if (kind === "word") return { ok: false, message: "Word files cannot be imported yet. Save the questions as .txt or .pdf, or paste them into a spreadsheet." };
  if (kind === "unknown") return { ok: false, message: "Supported files: .xlsx, .csv, .txt and .pdf." };
  if (kind !== "pdf" && file.size > MAX_SHEET_BYTES) return { ok: false, message: "This file is larger than 25 MB." };
  return { ok: true, kind };
}

// Spreadsheet or text file -> { sheets: [{ name, rows }] } | { text }
export async function readTable(bytesOrText, kind, { JSZip } = {}) {
  if (kind === "xlsx") return readXlsx(bytesOrText, { JSZip: JSZip || (await loadJsZip()) });
  const text = typeof bytesOrText === "string" ? bytesOrText : new TextDecoder("utf-8").decode(bytesOrText);
  if (kind === "csv") { const p = parseCsv(text); return { sheets: [{ name: "CSV", rows: p.rows }], note: p.unterminatedQuote ? "A quoted cell was never closed, so the end of the file may be merged into one cell." : null }; }
  return { text };
}

export function questionsFromSheet(sheet, ctx = {}) { return rowsToQuestions(sheet.rows, { sheetName: sheet.name, ...ctx }); }
export const questionsFromText = (text) => parseTextQuestions(text);

// ---- sending to the server ----
// Never sends the client's idea of "ready" blindly: the server re-checks everything. `approved` carries the admin's explicit OK.
export function toServerItem(q, { approved = false, skipIfDuplicate = false } = {}) {
  const it = {
    externalId: q.externalId || "", subject: q.subject || "", topic: q.topic || "", subtopic: q.subtopic || "",
    text: q.text || "", textHtml: q.textHtml || "", explanationHtml: q.explanationHtml || "", sourceStatus: q.sourceStatus || "",
    options: (q.options || []).map((o) => ({ key: o.key, text: o.text || "", html: o.html || "" })),
    correctKey: q.correctKey || null, explanation: q.explanation || "", explanationSource: q.explanationSource || "",
    questionType: q.questionType || "", imageRef: q.imageRef || "",
    sourceRefs: (q.sourceRefs || []).slice(0, 10), sourcePage: q.sourcePage ?? "", sourceLabel: q.sourceLabel || "",
    reviewState: q.state === "ready" || q.state === "ready_partial" ? "ready" : "needs_review", approved: approved || undefined,
    issues: [...new Set((q.issues || []).map((i) => i.code))].slice(0, 20), reviewNotes: q.reviewNotes || "",
  };
  if (q.marks !== undefined && q.marks !== null && q.marks !== "" && Number.isFinite(Number(q.marks))) it.marks = Number(q.marks);
  if (q.extra || q.sharedPassage) it.extra = { ...(q.extra || {}), ...(q.sharedPassage ? { "Shared passage group": `${q.sharedPassage.group} (${q.sharedPassage.size} questions)` } : {}) };
  if (skipIfDuplicate) it.skipIfDuplicate = true;
  return it;
}

export function makeBatches(items, maxItems = BATCH_MAX_ITEMS, maxBytes = BATCH_MAX_BYTES) {
  const batches = []; let cur = [], bytes = 0;
  for (const it of items) {
    const size = JSON.stringify(it).length + 2;
    if (cur.length && (cur.length >= maxItems || bytes + size > maxBytes)) { batches.push(cur); cur = []; bytes = 0; }
    cur.push(it); bytes += size;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export const newSessionId = () => `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Sends batches one at a time. Safe to cancel and to resume: pass the same sessionId and `startBatch`; the server ignores what it already has.
export async function runImport({ items, sessionId, post, document, allowIncomplete = false, onConflict = "skip", startBatch = 0, onProgress, signal }) {
  const batches = makeBatches(items);
  const totals = { created: 0, unchanged: 0, updated: 0, conflicts: [], rejected: [], possibleDuplicates: [], skippedDuplicates: [] };
  let offset = batches.slice(0, startBatch).reduce((n, b) => n + b.length, 0);
  for (let i = startBatch; i < batches.length; i++) {
    if (signal?.aborted) return { ...totals, status: "cancelled", nextBatch: i, totalBatches: batches.length, sessionId };
    let res;
    try { res = await post("/admin/bank/import", { sessionId, document, allowIncomplete, onConflict, questions: batches[i] }); }
    catch (err) { return { ...totals, status: "failed", error: err.message || String(err), nextBatch: i, totalBatches: batches.length, sessionId }; }
    totals.created += res.created || 0; totals.unchanged += res.unchanged || 0; totals.updated += res.updated || 0;
    totals.conflicts.push(...(res.conflicts || []).map((c) => ({ ...c, index: c.index + offset })));
    totals.rejected.push(...(res.rejected || []).map((r) => ({ ...r, index: r.index + offset })));
    totals.possibleDuplicates.push(...(res.possibleDuplicates || []).map((r) => ({ ...r, index: r.index + offset })));
    totals.skippedDuplicates.push(...(res.skippedDuplicates || []).map((r) => ({ ...r, index: r.index + offset })));
    offset += batches[i].length;
    onProgress?.({ batch: i + 1, totalBatches: batches.length, sent: offset, total: items.length });
  }
  return { ...totals, status: "done", nextBatch: batches.length, totalBatches: batches.length, sessionId };
}
