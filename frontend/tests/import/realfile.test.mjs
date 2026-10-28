// Real-file acceptance test. Needs the actual PDF; set VOL1_PDF=/path/Vol1_Oral_English.pdf.
// Without it the tests are reported as SKIPPED (never as passed).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const PDF = process.env.VOL1_PDF;
const skip = !PDF || !fs.existsSync(PDF) ? "set VOL1_PDF to run real-file checks" : false;

test("Vol1_Oral_English.pdf: real file through the vendored pdf.js", { skip }, async () => {
  globalThis.DOMMatrix ??= class DOMMatrix {}; // Node-only shim for pdf.js; browsers have it
  const pdfjs = await import("../../public/vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../public/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href; // Node needs it explicit; the browser reader sets /vendor/... itself
  const { readQuestionsFromPdf } = await import("../../src/lib/import/pdfReader.js");
  const r = await readQuestionsFromPdf(new Uint8Array(fs.readFileSync(PDF)), { pdfjs });
  assert.equal(r.mode, "id");
  const by = Object.fromEntries(r.questions.map((q) => [q.externalId, q]));
  // facts stated by the owner about this file
  assert.equal(r.report.total, 429);
  assert.deepEqual(r.report.sections.map((s) => [s.name, s.declared, s.found]), [["Consonant sounds", 84, 84], ["Emphatic stress", 83, 83], ["Rhymes", 58, 58], ["Vowel sounds", 100, 100], ["Word stress", 104, 104]]);
  assert.deepEqual([by["ORL-0001"].text, by["ORL-0001"].options.map((o) => o.text), by["ORL-0001"].correctKey, by["ORL-0001"].sourceRefs], ["film", ["salt", "psalm", "walk", "chalk"], "A", ["E2-X02-Q094"]]);
  assert.deepEqual([by["ORL-0005"].correctKey, by["ORL-0005"].sourceKey], ["B", "C"]);
  assert.ok(by["ORL-0107"].flags.some((f) => /STEM INCOMPLETE/.test(f)) && by["ORL-0107"].state === "incomplete");
  assert.ok(by["ORL-0166"].issues.some((i) => i.code === "KEY_CORRECTED"));
  // integrity: nothing invented, nothing swallowed
  assert.equal(r.questions.filter((q) => q.options.length < 2).length, 0);
  assert.equal(r.questions.filter((q) => !q.sourceRefs.length).length, 0, "every question kept its source reference");
  assert.equal(r.report.unattachedLines.filter((u) => u.page > 3 || u.after).length, 0, "no stray text after the first question");
  assert.equal(r.report.key.matched + r.report.key.questionsWithoutKeyEntry, 429);
  assert.equal(r.report.key.keyEntriesWithoutQuestion.length, 0);
  assert.ok(r.report.key.truncated > 0, "truncated key entries are counted, not completed");
  for (const q of r.questions) if (!q.importable) assert.notEqual(q.state, "ready");
  console.log("# REAL FILE REPORT", JSON.stringify({ total: r.report.total, byState: r.report.byState, importable: r.report.importable, issueCounts: r.report.issueCounts, key: { ...r.report.key, keyEntriesWithoutQuestion: r.report.key.keyEntriesWithoutQuestion.length }, headerFooterLinesRemoved: r.report.headerFooterLinesRemoved }));
});
