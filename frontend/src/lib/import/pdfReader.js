// Browser-side PDF reading. pdf.js is vendored under /vendor and loaded on demand, so it adds no npm
// dependency and nothing to the Vite bundle. Functions take an optional `pdfjs` module so the same
// code runs in tests (Node) with the same library.
import { layoutDocument } from "./pdfLayout.js";
import { parseIdLines, isIdMode, classifyQuestion } from "./idParser.js";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MIN_TEXT_CHARS = 25; // below this a page is treated as having no usable text layer

let cached = null;
export function loadPdfJs() {
  if (!cached) {
    cached = import(/* @vite-ignore */ "/vendor/pdfjs/pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      return m;
    });
    cached.catch(() => { cached = null; }); // allow a retry after a network failure
  }
  return cached;
}

export function validatePdfFile(file, maxBytes = MAX_PDF_BYTES) {
  if (!file) return { ok: false, message: "Choose a PDF file first." };
  const name = (file.name || "").toLowerCase();
  if (!name.endsWith(".pdf") && file.type !== "application/pdf") return { ok: false, message: "This is not a PDF file." };
  if (file.size === 0) return { ok: false, message: "The file is empty." };
  if (file.size > maxBytes) return { ok: false, message: `The file is larger than ${Math.round(maxBytes / 1048576)} MB.` };
  return { ok: true };
}

export function hasPdfHeader(bytes) {
  const head = String.fromCharCode(...bytes.slice(0, 1024));
  return head.includes("%PDF-");
}

async function openDoc(pdfjs, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (!hasPdfHeader(bytes)) throw new Error("The file does not look like a valid PDF.");
  return pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
}

const toItems = (tc) => tc.items.filter((i) => typeof i.str === "string").map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }));

// Page count, metadata and a text/scanned verdict from an evenly spaced sample of pages.
export async function inspectPdf(data, { pdfjs, sampleSize = 12 } = {}) {
  const lib = pdfjs || (await loadPdfJs());
  const doc = await openDoc(lib, data);
  try {
    const n = doc.numPages;
    const pick = new Set();
    for (let k = 0; k < Math.min(sampleSize, n); k++) pick.add(Math.max(1, Math.round(1 + (k * (n - 1)) / Math.max(1, Math.min(sampleSize, n) - 1))));
    const sample = [];
    for (const p of [...pick].sort((a, b) => a - b)) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      const chars = tc.items.reduce((a, i) => a + (i.str ? i.str.trim().length : 0), 0);
      sample.push({ page: p, chars, kind: chars >= MIN_TEXT_CHARS ? "text" : "no_text" });
      pg.cleanup();
    }
    const noText = sample.filter((s) => s.kind === "no_text").length;
    const kind = noText === 0 ? "text" : noText === sample.length ? "scanned" : "mixed";
    let info = {};
    try { info = (await doc.getMetadata()).info || {}; } catch { /* metadata is optional */ }
    return {
      pageCount: n, kind, sample, info: { title: info.Title || null, author: info.Author || null, producer: info.Producer || null },
      needsOcr: kind !== "text",
      warning: kind === "text" ? null : "Some or all pages have no text layer (scanned images). OCR is not supported, so those pages cannot be imported.",
    };
  } finally { await doc.destroy(); }
}

// Extract text items for the chosen pages. A failing page is recorded and skipped; it never aborts the run.
export async function extractPdfPages(data, { pdfjs, pages, onProgress, signal } = {}) {
  const lib = pdfjs || (await loadPdfJs());
  const doc = await openDoc(lib, data);
  const out = [], failures = [], noText = [];
  try {
    const list = pages && pages.length ? pages : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    let done = 0;
    for (const p of list) {
      if (signal?.aborted) { const e = new Error("Cancelled"); e.name = "AbortError"; throw e; }
      try {
        const pg = await doc.getPage(p);
        const vp = pg.getViewport({ scale: 1 });
        const items = toItems(await pg.getTextContent());
        const chars = items.reduce((a, i) => a + i.str.trim().length, 0);
        if (chars < MIN_TEXT_CHARS) noText.push(p);
        out.push({ page: p, width: vp.width, height: vp.height, items });
        pg.cleanup();
      } catch (err) { failures.push({ page: p, error: String(err?.message || err) }); }
      done++;
      onProgress?.({ done, total: list.length, page: p });
    }
  } finally { await doc.destroy(); }
  return { pages: out, failures, noText };
}

// Questions touching a page that failed, or sitting right next to one, may have lost text: mark them.
export function applyPageFailures(questions, failedPages) {
  if (!failedPages.length) return questions;
  for (const q of questions) {
    const { pageStart: a, pageEnd: b } = q.provenance;
    const hit = failedPages.filter((f) => (f >= a && f <= b) || f === a - 1 || f === b + 1);
    if (hit.length) { q.issues.push({ code: "EXTRACTION", severity: "error", detail: `Page ${hit.join(", ")} could not be read, so this question may be missing text.` }); classifyQuestion(q); }
  }
  return questions;
}

// Whole pipeline for a PDF held in memory.
export async function readQuestionsFromPdf(data, opts = {}) {
  const extracted = await extractPdfPages(data, opts);
  const layout = layoutDocument(extracted.pages, opts);
  if (!isIdMode(layout.lines)) {
    return { mode: "unsupported", reason: "No ID-style questions detected; the generic numbered-question parser is not built yet.", layout, extracted, questions: [], report: null };
  }
  const parsed = parseIdLines(layout.lines);
  applyPageFailures(parsed.questions, extracted.failures.map((f) => f.page));
  parsed.report.pagesWithoutText = extracted.noText;
  parsed.report.pageFailures = extracted.failures;
  parsed.report.headerFooterLinesRemoved = layout.removed.length;
  parsed.report.pageModes = layout.pages.map((p) => ({ page: p.page, mode: p.mode }));
  return { mode: "id", layout, extracted, ...parsed };
}
