// Real-file acceptance: the user's actual workbooks -> the real importer -> the real bankController -> an exam.
// Skipped (never "passed") unless CHEM_XLSX and ENGLISH_XLSX point at the files.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const CHEM = process.env.CHEM_XLSX, ENG = process.env.ENGLISH_XLSX;
const skip = !CHEM || !ENG || !fs.existsSync(CHEM || "") || !fs.existsSync(ENG || "") ? "set CHEM_XLSX and ENGLISH_XLSX to run" : false;
const lib = (f) => import(pathToFileURL(path.join(__dirname, "../../frontend/src/lib/import", f)).href);
// jszip.min.js is a classic script and frontend/package.json is "type": "module", so require() would not give the library.
const JSZip = () => { const src = fs.readFileSync(path.join(__dirname, "../../frontend/public/vendor/jszip.min.js"), "utf8"); const m = { exports: {} }; new Function("module", "exports", src).call(m.exports, m, m.exports); return m.exports; };

const db = require("./helpers/fakeDb");
const c = require("../controllers/bankController");
const { publicQuestion } = require("../utils/cbt");
const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ user: { id: "admin1" }, body: {}, params: {}, query: {}, ...req }, r); return r; };
const post = async (p, body) => { assert.equal(p, "/admin/bank/import"); const r = await call(c.importBatch, { body }); assert.ok(r.statusCode < 300); return r.body; };

async function prepare(file, ctx = {}) {
  const { readTable, questionsFromSheet } = await lib("importPipeline.js");
  const { stampUids } = await lib("importFlow.js");
  const t = await readTable(fs.readFileSync(file), "xlsx", { JSZip: JSZip() });
  const r = questionsFromSheet(t.sheets[0], ctx);
  return { ...r, questions: stampUids(r.questions) };
}

test("CHEMISTRY workbook: import everything, re-import safely, find and finish incomplete questions, use them in an exam", { skip, timeout: 120000 }, async () => {
  db.reset();
  const { buildItems } = await lib("importFlow.js");
  const { runImport } = await lib("importPipeline.js");
  const r = await prepare(CHEM);
  const all = new Set(r.questions.map((q) => q.uid));
  const { items } = buildItems(r.questions, all, { allowIncomplete: true });
  // "needs review" questions are not approved here, so they are correctly left out; everything else is sent
  const sendable = r.questions.filter((q) => q.importable || ["missing_answer", "invalid_options", "incomplete", "missing_visual", "extraction_failure"].includes(q.state)).length;
  assert.equal(items.length, sendable);

  const first = await runImport({ items, sessionId: "imp-real-chem-0001", post, document: "chem.xlsx", allowIncomplete: true });
  assert.equal(first.status, "done");
  assert.equal(first.rejected.length, 0, "everything that was sent was accepted by the server");
  assert.equal(first.created, items.length, "every sent question was stored");
  assert.equal(db.bankDocs.length, items.length);

  const again = await runImport({ items, sessionId: "imp-real-chem-0001", post, document: "chem.xlsx", allowIncomplete: true });
  assert.deepEqual([again.created, again.unchanged, db.bankDocs.length], [0, items.length, items.length], "re-import adds nothing");

  const docs = db.bankDocs;
  assert.equal(docs.filter((d) => d.usable && !d.correctKey).length, 0, "nothing without an answer is usable");
  assert.equal(docs.filter((d) => d.usable && /diagram/i.test(d.questionType || "")).length, 0, "no diagram question is usable");
  assert.equal(docs.filter((d) => d.usable && d.options.filter((o) => o.text).length < 2).length, 0);
  assert.equal(docs.filter((d) => (d.options || []).some((o) => !["A", "B", "C", "D", "E", "F"].includes(o.key))).length, 0);

  const list = async (query) => (await call(c.list, { query: { limit: "100", ...query } })).body;
  const missingAnswer = (await list({ flag: "missing_answer" })).total, incomplete = (await list({ flag: "incomplete" })).total, usable = (await list({ flag: "usable" })).total;
  assert.equal(usable + incomplete, docs.length);
  assert.ok(missingAnswer > 0 && usable > 0);

  // finish one incomplete question: it becomes usable, persists, and shows in the "ready" list
  const target = docs.find((d) => !d.usable && d.problems.length === 1 && d.problems[0] === "NO_ANSWER");
  if (target) {
    const filled = target.options.find((o) => o.text);
    const e = await call(c.edit, { params: { id: target._id }, body: { correctKey: filled.key, solutionText: "Worked solution written by an administrator." } });
    assert.equal(e.statusCode, 200);
    assert.equal(db.bankDocs.find((d) => d._id === target._id).usable, true);
    assert.equal((await list({ flag: "usable" })).total, usable + 1);
  }

  // use questions in an exam
  const exam = db.newExam();
  const picks = (await list({ flag: "usable" })).questions.slice(0, 50).map((q) => q.id);
  const add = await call(c.addToExam, { body: { examId: exam._id, ids: picks } });
  assert.equal(add.body.added, 50);
  assert.ok(exam.questions.every((q) => q.correctKey && q.options.length >= 2 && q.bankId));
  const five = exam.questions.find((q) => q.options.length >= 5);
  if (five) assert.ok(publicQuestion(five).options.length >= 5, "5-option questions reach the student intact");
  const incompleteId = docs.find((d) => !d.usable)._id;
  assert.equal((await call(c.addToExam, { body: { examId: exam._id, ids: [incompleteId] } })).body.skipped[0].reason, "incomplete");
  console.log("# REAL CHEMISTRY", JSON.stringify({ rows: r.report.questions, sent: items.length, stored: docs.length, usable: usable + (target ? 1 : 0), incomplete: incomplete - (target ? 1 : 0), missingAnswer, reimportCreated: again.created }));
});

test("ENGLISH 13th Mock: legacy layout confirmed by the admin, formatting stored, used in an exam, student sees the underline but not the answer", { skip, timeout: 60000 }, async () => {
  db.reset();
  const { buildItems, defaultSelection } = await lib("importFlow.js");
  const { runImport } = await lib("importPipeline.js");
  const first = await prepare(ENG);
  assert.equal(first.report.needsMappingConfirmation, true, "a header-less file asks for confirmation");
  assert.equal(first.report.mappingConfidence, "high");
  const r = await prepare(ENG, { mapping: first.mapping, mappingConfirmed: true });
  const { items } = buildItems(r.questions, defaultSelection(r.questions), { allowIncomplete: false });
  const out = await runImport({ items, sessionId: "imp-real-eng-0001", post, document: "english.xlsx" });
  assert.equal(out.rejected.length, 0);
  assert.equal(out.created, 60);
  assert.equal(db.bankDocs.filter((d) => /<u>/.test(d.textHtml || "")).length, 17);
  assert.equal(db.bankDocs.filter((d) => /<script|onerror|javascript:/i.test(JSON.stringify(d))).length, 0);
  assert.equal(db.bankDocs.filter((d) => d.awaitingSolution).length, 13, "blank explanations are flagged for the administrator");
  assert.ok(db.bankDocs.every((d) => !d.externalId), "no IDs were invented");
  const exam = db.newExam();
  const ids = db.bankDocs.map((d) => String(d._id));
  assert.equal((await call(c.addToExam, { body: { examId: exam._id, ids } })).body.added, 60);
  const underlined = exam.questions.find((q) => /<u>/.test(q.textHtml || ""));
  const seen = publicQuestion({ ...underlined, _id: "q1" });
  assert.match(seen.textHtml, /<u>/);
  assert.ok(!JSON.stringify(seen).includes("correctKey") && !JSON.stringify(seen).includes('"explanation"'));
  console.log("# REAL ENGLISH", JSON.stringify({ rows: r.report.questions, stored: db.bankDocs.length, underlined: 17, missingExplanation: 13 }));
});
