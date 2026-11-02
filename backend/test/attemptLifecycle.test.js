const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeFinaliser, MAX_TRIES } = require("../utils/attemptLifecycle");
const { makeSweeper } = require("../utils/attemptSweeper");
const { fakeAttemptModel, clone } = require("./helpers/fakeAttemptModel");

const exam = { questions: [
  { _id: "q1", correctKey: "A", marks: 1 },
  { _id: "q2", correctKey: "B", marks: 2 },
] };
const inProgress = (over = {}) => ({ _id: "a1", status: "in_progress", answers: {}, rev: 0, deadline: new Date(Date.now() - 1000).toISOString(), ...over });

test("finalise scores and closes an attempt", async () => {
  const docs = new Map([["a1", inProgress({ answers: { q1: "A", q2: "B" } })]]);
  const done = await makeFinaliser(fakeAttemptModel(docs))(docs.get("a1"), exam, false);
  assert.equal(done.status, "submitted");
  assert.equal(done.score, 3);
  assert.equal(done.autoSubmitted, false);
});

test("finalise twice returns the same stored result (no re-scoring, no overwrite)", async () => {
  const docs = new Map([["a1", inProgress({ answers: { q1: "A" } })]]);
  const fin = makeFinaliser(fakeAttemptModel(docs));
  const first = await fin(docs.get("a1"), exam, true);
  const second = await fin(clone(docs.get("a1")), exam, false);
  assert.equal(second.submittedAt, first.submittedAt);
  assert.equal(second.autoSubmitted, true);
});

test("a save that lands after the snapshot is read is included in the score", async () => {
  const stale = inProgress({ rev: 0, answers: {} });
  const docs = new Map([["a1", inProgress({ rev: 1, answers: { q2: "B" } })]]);
  const done = await makeFinaliser(fakeAttemptModel(docs))(stale, exam, false);
  assert.equal(done.score, 2);
  assert.equal(done.correct, 1);
});

test("attempts created before rev existed can still be closed", async () => {
  const legacy = inProgress({ answers: { q1: "A" } });
  delete legacy.rev;
  const docs = new Map([["a1", legacy]]);
  const done = await makeFinaliser(fakeAttemptModel(docs))(clone(legacy), exam, false);
  assert.equal(done.status, "submitted");
  assert.equal(done.score, 1);
});

test("if the attempt keeps changing, finalise gives up with an error instead of storing a stale score", async () => {
  const docs = new Map([["a1", inProgress()]]);
  const model = fakeAttemptModel(docs, { beforeUpdate: (m) => { m.get("a1").rev += 1; } });
  await assert.rejects(() => makeFinaliser(model)(docs.get("a1"), exam, false), /kept changing/);
  assert.equal(docs.get("a1").status, "in_progress");
  assert.ok(MAX_TRIES >= 3);
});

test("two simultaneous closes produce one stored result", async () => {
  const docs = new Map([["a1", inProgress({ answers: { q1: "A" } })]]);
  const fin = makeFinaliser(fakeAttemptModel(docs));
  const [x, y] = await Promise.all([fin(clone(docs.get("a1")), exam, true), fin(clone(docs.get("a1")), exam, false)]);
  assert.equal(x.status, "submitted");
  assert.equal(y.status, "submitted");
  assert.equal(x.score, y.score);
});

// ---- sweeper ----
const silent = { error() {}, warn() {}, log() {} };
const past = () => new Date(Date.now() - 60000).toISOString();
const future = () => new Date(Date.now() + 600000).toISOString();

test("sweeper closes expired in-progress attempts only, as auto-submitted", async () => {
  const docs = new Map([
    ["old", inProgress({ _id: "old", examId: "e", deadline: past(), answers: { q1: "A" } })],
    ["live", inProgress({ _id: "live", examId: "e", deadline: future() })],
    ["done", { _id: "done", status: "submitted", examId: "e", deadline: past(), answers: {} }],
  ]);
  const Attempt = fakeAttemptModel(docs);
  const sweep = makeSweeper({ Attempt, Exam: { findById: () => ({ lean: async () => exam }) }, finalise: makeFinaliser(Attempt), log: silent });
  const r = await sweep();
  assert.deepEqual(r, { found: 1, closed: 1, failed: 0 });
  assert.equal(docs.get("old").status, "submitted");
  assert.equal(docs.get("old").autoSubmitted, true);
  assert.equal(docs.get("live").status, "in_progress");
});

test("sweeper leaves an attempt alone while it is inside the reconnection grace period", async () => {
  const docs = new Map([
    ["grace", inProgress({ _id: "grace", examId: "e", deadline: past(), closeAt: future() })],
    ["over", inProgress({ _id: "over", examId: "e", deadline: past(), closeAt: past() })],
  ]);
  const Attempt = fakeAttemptModel(docs);
  const sweep = makeSweeper({ Attempt, Exam: { findById: () => ({ lean: async () => exam }) }, finalise: makeFinaliser(Attempt), log: silent });
  const r = await sweep();
  assert.equal(r.closed, 1);
  assert.equal(docs.get("grace").status, "in_progress");
  assert.equal(docs.get("over").status, "submitted");
});

test("an attempt whose exam is gone does not block the others or get retried forever", async () => {
  const docs = new Map([
    ["orphan", inProgress({ _id: "orphan", examId: "gone", deadline: new Date(Date.now() - 90000).toISOString() })],
    ["ok", inProgress({ _id: "ok", examId: "e", deadline: past() })],
  ]);
  const Attempt = fakeAttemptModel(docs);
  const Exam = { findById: (id) => ({ lean: async () => (id === "e" ? exam : null) }) };
  const sweep = makeSweeper({ Attempt, Exam, finalise: makeFinaliser(Attempt), log: silent });
  const first = await sweep(new Date(), 1);
  assert.equal(first.failed, 1);
  const second = await sweep(new Date(), 1);
  assert.equal(second.closed, 1);
  assert.equal(docs.get("ok").status, "submitted");
});

test("overlapping sweeps are skipped", async () => {
  const docs = new Map([["old", inProgress({ _id: "old", examId: "e", deadline: past() })]]);
  const Attempt = fakeAttemptModel(docs);
  const sweep = makeSweeper({ Attempt, Exam: { findById: () => ({ lean: async () => exam }) }, finalise: makeFinaliser(Attempt), log: silent });
  const [a, b] = await Promise.all([sweep(), sweep()]);
  assert.ok(a.skipped || b.skipped);
});

// ---- wiring (read the source: the real modules need MongoDB, which is not used in unit tests) ----
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("every saved answer bumps rev, and the model declares it", () => {
  assert.match(read("controllers/examController.js"), /\$inc:\s*\{\s*rev:\s*1/);
  assert.match(read("models/Attempt.js"), /rev:\s*\{\s*type:\s*Number/);
});

test("the answer-saving route is rate limited before validation", () => {
  assert.match(read("routes/cbtRoutes.js"), /\/attempts\/:id\/answers",\s*saveLimiter,\s*validate/);
});

test("the server starts the deadline sweeper", () => {
  assert.match(read("app.js"), /startSweeper\(\)/);
});

test("correct answers still never reach a running exam", () => {
  const src = read("controllers/examController.js");
  const running = src.slice(src.indexOf("const runningPayload"), src.indexOf("// Loads an attempt only"));
  assert.ok(!/correctKey|explanation/.test(running));
});

test("the close reason is stored: student by default, time_up for automatic, or the one given", async () => {
  for (const [auto, reason, expected] of [[false, undefined, "student"], [true, undefined, "time_up"], [true, "violation_limit", "violation_limit"]]) {
    const docs = new Map([["a1", inProgress()]]);
    const done = await makeFinaliser(fakeAttemptModel(docs))(docs.get("a1"), exam, auto, reason);
    assert.equal(done.submitReason, expected);
  }
});

test("onClosed runs once, only for the call that closed the attempt, and cannot break the close", async () => {
  const docs = new Map([["a1", inProgress({ answers: { q1: "A" } })]]);
  const calls = [];
  const fin = makeFinaliser(fakeAttemptModel(docs), { onClosed: async (a, info) => { calls.push(info.reason); throw new Error("log failed"); } });
  const first = await fin(clone(docs.get("a1")), exam, false);
  await fin(clone(docs.get("a1")), exam, false); // already closed
  assert.equal(first.status, "submitted");
  assert.deepEqual(calls, ["student"]);
});
