const { test } = require("node:test");
const assert = require("node:assert/strict");
const b = require("../utils/bank");
const { OPTION_KEYS, scoreAttempt, parseQuestionText, publicQuestion } = require("../utils/cbt");

const OK = { externalId: "CHM-0001", subject: "Chemistry", topic: "Atoms", text: "What is H₂O?", options: [{ key: "A", text: "water" }, { key: "B", text: "salt" }], correctKey: "A" };

test("six options: the letters are A to F", () => assert.deepEqual(OPTION_KEYS, ["A", "B", "C", "D", "E", "F"]));

test("six options: pasted text with option F and 'Answer: F' is read correctly; G is not an option", () => {
  const text = "Q: Pick one\nA) a\nB) b\nC) c\nD) d\nE) e\nF) f\nAnswer: F\n";
  const { questions, errors } = parseQuestionText(text);
  assert.equal(errors.length, 0);
  assert.equal(questions[0].options.length, 6);
  assert.equal(questions[0].correctKey, "F");
  const bad = parseQuestionText("Q: Pick\nA) a\nB) b\nAnswer: G\n");
  assert.equal(bad.questions.length, 0); // no answer recognised: reported, never guessed
  assert.equal(bad.errors.length, 1);
});

test("six options: scoring and the student view work with option F", () => {
  const qs = [{ _id: "1", text: "t", correctKey: "F", marks: 1, options: ["A", "B", "F"].map((k) => ({ key: k, text: k })), explanation: "secret" }];
  assert.equal(scoreAttempt(qs, { 1: "F" }).correct, 1);
  assert.equal(scoreAttempt(qs, { 1: "A" }).incorrect, 1);
  assert.ok(!JSON.stringify(publicQuestion(qs[0])).includes("secret"));
});

test("a complete question is usable; an answer that points at a missing option is a problem", () => {
  assert.deepEqual(b.problemsOf(OK), []);
  assert.deepEqual(b.problemsOf({ ...OK, correctKey: "E" }).map((p) => p.code), ["BAD_ANSWER"]);
  assert.deepEqual(b.problemsOf({ ...OK, correctKey: undefined }).map((p) => p.code), ["NO_ANSWER"]);
});

test("an answer that points at an EMPTY option is a problem, never silently accepted", () => {
  const codes = b.problemsOf({ ...OK, options: [{ key: "A", text: "x" }, { key: "B", text: "y" }, { key: "C", text: "" }], correctKey: "C" }).map((p) => p.code);
  assert.ok(codes.includes("EMPTY_OPTION") && codes.includes("BAD_ANSWER"));
});

test("a diagram-dependent question is never usable (with or without an image reference) until diagrams are supported", () => {
  assert.ok(b.problemsOf({ ...OK, questionType: "Multiple Choice (diagram-dependent)" }).some((p) => p.code === "VISUAL"));
  assert.ok(b.problemsOf({ ...OK, questionType: "Multiple Choice (diagram-dependent)", imageRef: "fig-3.png" }).some((p) => p.code === "VISUAL"));
  assert.deepEqual(b.problemsOf({ ...OK, questionType: "Multiple Choice" }), []);
});

test("import: invalid questions are rejected by default and kept as incomplete only when explicitly allowed", () => {
  const noAnswer = { ...OK, correctKey: undefined };
  assert.equal(b.prepareImportItem(noAnswer).ok, false);
  const kept = b.prepareImportItem(noAnswer, { allowIncomplete: true });
  assert.equal(kept.ok, true);
  assert.equal(kept.doc.usable, false);
  assert.equal(kept.doc.review.status, "incomplete");
  assert.equal(kept.doc.correctKey, undefined, "the missing answer stays missing");
});

test("import: 'needs review' questions need the administrator's explicit approval", () => {
  assert.equal(b.prepareImportItem({ ...OK, reviewState: "needs_review" }).reason, "needs_approval");
  const ok = b.prepareImportItem({ ...OK, reviewState: "needs_review", approved: true });
  assert.equal(ok.doc.review.status, "approved");
});

test("import keeps source metadata and unmapped columns", () => {
  const r = b.prepareImportItem({ ...OK, sourceRefs: ["P-12"], sourcePage: 12, sourceLabel: "Part V", explanation: "Because.", explanationSource: "Extracted from source", extra: { Difficulty: "Hard" } });
  assert.deepEqual(r.doc.source, { refs: ["P-12"], page: "12", label: "Part V" });
  assert.equal(r.doc.extra.Difficulty, "Hard");
  assert.equal(r.doc.explanationSource, "Extracted from source");
  assert.equal(r.doc.awaitingSolution, false);
});

test("content hash: same content -> same hash; any change -> different hash; option order does not matter", () => {
  const h = (o) => b.prepareImportItem(o).doc.contentHash;
  assert.equal(h(OK), h({ ...OK, options: [...OK.options].reverse() }));
  assert.notEqual(h(OK), h({ ...OK, correctKey: "B" }));
  assert.notEqual(h(OK), h({ ...OK, text: "What is H2O?" }));
});

test("identity: the source ID is used when there is one, otherwise a hash of wording and options", () => {
  assert.equal(b.externalKeyOf(OK), "CHM-0001");
  const a = b.externalKeyOf({ ...OK, externalId: "" }), c = b.externalKeyOf({ ...OK, externalId: undefined, options: [...OK.options].reverse() });
  assert.ok(a.startsWith("hash:")); assert.equal(a, c);
  assert.notEqual(a, b.externalKeyOf({ ...OK, externalId: "", options: [{ key: "A", text: "water" }, { key: "B", text: "sand" }] }));
});

test("admin edit: completing a question makes it usable; the solution is labelled admin-written with author and date", () => {
  const incomplete = b.prepareImportItem({ ...OK, correctKey: undefined }, { allowIncomplete: true }).doc;
  const when = new Date("2026-01-02T03:04:05Z");
  const next = b.applyEdit({ ...incomplete, version: 1 }, { correctKey: "a", solutionText: "Water is H2O." }, "admin1", when);
  assert.equal(next.correctKey, "A");
  assert.equal(next.usable, true);
  assert.equal(next.awaitingSolution, false);
  assert.deepEqual(next.solution, { text: "Water is H2O.", by: "admin1", at: when, status: "admin_written" });
  assert.equal(next.version, 2); assert.equal(next.edited, true); assert.equal(next.review.status, "approved");
});

test("admin edit: a broken edit leaves the question flagged, not usable", () => {
  const next = b.applyEdit({ ...b.prepareImportItem(OK).doc, version: 1 }, { options: [{ key: "A", text: "water" }] }, "admin1");
  assert.equal(next.usable, false); assert.ok(next.problems.includes("FEW_OPTIONS")); assert.equal(next.review.status, "incomplete");
});

test("exam snapshot: carries the admin solution with its provenance, otherwise the source explanation", () => {
  const base = { ...b.prepareImportItem({ ...OK, explanation: "From the source." }).doc, _id: "id1", version: 3 };
  assert.deepEqual([b.examSnapshot(base).explanation, b.examSnapshot(base).explanationSource, b.examSnapshot(base).bankVersion], ["From the source.", "source", 3]);
  const s = b.examSnapshot({ ...base, solution: { text: "Mine", status: "admin_written" } });
  assert.deepEqual([s.explanation, s.explanationSource], ["Mine", "admin_written"]);
  assert.equal(b.examSnapshot({ ...base, explanation: "" }).explanationSource, undefined);
});

test("search text is escaped so it cannot be used as a regular-expression attack", () => {
  assert.equal(b.escapeRegex("a.b*(c)"), "a\\.b\\*\\(c\\)");
});
