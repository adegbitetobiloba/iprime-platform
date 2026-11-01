const test = require("node:test");
const assert = require("node:assert/strict");
const { toCsv, cell, safeFilename } = require("../utils/csv");
const { buildResultRows, resultsCsv } = require("../utils/cohortExport");

test("quotes commas, quotes and newlines", () => {
  assert.equal(cell('a,b'), '"a,b"'); assert.equal(cell('say "hi"'), '"say ""hi"""'); assert.equal(cell("a\nb"), '"a\nb"');
});

test("neutralises spreadsheet formulas in text but leaves numbers alone", () => {
  for (const bad of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx"]) assert.ok(cell(bad).startsWith("'") || cell(bad).startsWith('"\''), bad);
  assert.equal(cell(-5), "-5"); assert.equal(cell(0), "0"); assert.equal(cell(true), "Yes"); assert.equal(cell(null), "");
});

test("BOM, CRLF and header row", () => {
  const out = toCsv([{ a: 1 }], [{ header: "A", value: (r) => r.a }]);
  assert.ok(out.startsWith("﻿A\r\n1\r\n"));
});

test("filename is safe", () => {
  assert.equal(safeFilename('Maths "Mock" 3/../x'), "Maths-Mock-3-.-x");
  assert.ok(!/[\\/"\s]/.test(safeFilename('a b/c"d')));
  assert.equal(safeFilename(""), "export");
});

const at = (id, user, pct, day, extra = {}) => ({ _id: id, userId: user, status: "submitted", submittedAt: new Date(`2026-10-${day}T10:00:00Z`), percentage: pct, score: pct, totalMarks: 100, correct: pct, incorrect: 100 - pct, unanswered: 0, ...extra });
const users = [{ _id: "u1", firstName: "Ada", lastName: "Obi", studentId: "PET-1", email: "secret@x.com", phone: "0800" }, { _id: "u2", firstName: "=HYPERLINK", lastName: "Evil", studentId: "PET-2" }];

test("one row per student from the first attempt, ties share a rank", () => {
  const rows = buildResultRows({ attempts: [at("a1", "u1", 50, "01"), at("a2", "u1", 90, "02"), at("a3", "u2", 50, "01", { submittedAt: new Date("2026-10-01T11:00:00Z") })], users });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.rank), [1, 1]);
  assert.equal(rows.find((r) => r.studentId === "PET-1").attemptsAtThisExam, 2);
  assert.equal(rows.find((r) => r.studentId === "PET-1").percentage, 50); // first attempt, not the retake
});

test("export never contains contact data and neutralises hostile names", () => {
  const csv = resultsCsv({ attempts: [at("a1", "u1", 50, "01"), at("a3", "u2", 40, "01")], users });
  assert.ok(!csv.includes("secret@x.com")); assert.ok(!csv.includes("0800"));
  assert.ok(csv.includes("'=HYPERLINK Evil"));
  assert.ok(csv.split("\r\n")[0].includes("Rank"));
});

test("unknown student is shown as a former student, empty cohort is header only", () => {
  assert.ok(resultsCsv({ attempts: [at("a1", "gone", 50, "01")], users: [] }).includes("Former student"));
  assert.equal(resultsCsv({ attempts: [], users: [] }).trim().split("\r\n").length, 1);
});
