const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { graceSecondsFromEnv, phaseOf, planSync, makeSyncer, TOLERANCE_MS } = require("../utils/lateSync");
const { makeFinaliser } = require("../utils/attemptLifecycle");
const { fakeAttemptModel, clone } = require("./helpers/fakeAttemptModel");

const MIN = 60000;
const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);            // start of the exam
const DEADLINE = T0 + 30 * MIN;
const CLOSE = DEADLINE + 10 * MIN;                      // 10-minute grace
const iso = (t) => new Date(t).toISOString();

const exam = { questions: [
  { _id: "q1", correctKey: "A", marks: 1, options: [{ key: "A" }, { key: "B" }] },
  { _id: "q2", correctKey: "B", marks: 2, options: [{ key: "A" }, { key: "B" }] },
  { _id: "q3", correctKey: "A", marks: 1, options: [{ key: "A" }, { key: "B" }] },
] };
const attempt = (over = {}) => ({ _id: "a1", examId: "e", status: "in_progress", startedAt: iso(T0), deadline: iso(DEADLINE), closeAt: iso(CLOSE), answers: {}, flagged: [], rev: 0, ...over });

test("graceSecondsFromEnv: default 10 minutes, 0 or junk switches it off, capped at 60", () => {
  assert.equal(graceSecondsFromEnv({}), 600);
  assert.equal(graceSecondsFromEnv({ EXAM_RECONNECT_GRACE_MINUTES: "5" }), 300);
  assert.equal(graceSecondsFromEnv({ EXAM_RECONNECT_GRACE_MINUTES: "0" }), 0);
  assert.equal(graceSecondsFromEnv({ EXAM_RECONNECT_GRACE_MINUTES: "abc" }), 0);
  assert.equal(graceSecondsFromEnv({ EXAM_RECONNECT_GRACE_MINUTES: "-3" }), 0);
  assert.equal(graceSecondsFromEnv({ EXAM_RECONNECT_GRACE_MINUTES: "500" }), 3600);
});

test("phaseOf: open, grace, ended; an attempt with no closeAt ends at the deadline", () => {
  const a = attempt();
  assert.equal(phaseOf(a, DEADLINE - 1), "open");
  assert.equal(phaseOf(a, DEADLINE), "grace");
  assert.equal(phaseOf(a, CLOSE - 1), "grace");
  assert.equal(phaseOf(a, CLOSE), "ended");
  const legacy = attempt(); delete legacy.closeAt;
  assert.equal(phaseOf(legacy, DEADLINE), "ended");
});

test("before the deadline everything is accepted, timestamps not needed", () => {
  const p = planSync(attempt(), exam, [{ questionId: "q1", choice: "A" }, { questionId: "q2", choice: "B", flagged: true }], DEADLINE - MIN);
  assert.equal(p.phase, "open");
  assert.equal(p.accepted, 2);
  assert.equal(p.update.$set["answers.q1"], "A");
  assert.deepEqual(p.update.$set.flagged, ["q2"]);
  assert.equal(p.update.$set.lateSynced, undefined);
});

test("in the grace period only answers dated before the deadline are accepted", () => {
  const entries = [
    { questionId: "q1", choice: "A", answeredAt: iso(DEADLINE - 2 * MIN) },
    { questionId: "q2", choice: "B", answeredAt: iso(DEADLINE + 3 * MIN) },     // after the deadline: refused
    { questionId: "q3", choice: "A" },                                           // no timestamp: refused
  ];
  const p = planSync(attempt(), exam, entries, DEADLINE + 4 * MIN);
  assert.equal(p.phase, "grace");
  assert.equal(p.accepted, 1);
  assert.deepEqual(p.rejected.map((r) => r.reason).sort(), ["after_deadline", "no_timestamp"]);
  assert.equal(p.update.$set["answers.q1"], "A");
  assert.equal(p.update.$set["answers.q2"], undefined);
  assert.equal(p.update.$set.lateSynced, true);
  assert.equal(p.update.$set.lateSyncedCount, 1);
  assert.equal(p.update.$set.lateSyncRejected, 2);
});

test("a timestamp just past the deadline is allowed within the clock tolerance, but not beyond it", () => {
  const near = planSync(attempt(), exam, [{ questionId: "q1", choice: "A", answeredAt: iso(DEADLINE + TOLERANCE_MS - 1000) }], DEADLINE + MIN);
  assert.equal(near.accepted, 1);
  const far = planSync(attempt(), exam, [{ questionId: "q1", choice: "A", answeredAt: iso(DEADLINE + TOLERANCE_MS + 1000) }], DEADLINE + MIN);
  assert.equal(far.accepted, 0);
});

test("a timestamp from before the exam started is refused", () => {
  const p = planSync(attempt(), exam, [{ questionId: "q1", choice: "A", answeredAt: iso(T0 - 5 * MIN) }], DEADLINE + MIN);
  assert.equal(p.accepted, 0);
  assert.equal(p.rejected[0].reason, "before_start");
});

test("after the closing time nothing is accepted", () => {
  const p = planSync(attempt(), exam, [{ questionId: "q1", choice: "A", answeredAt: iso(DEADLINE - MIN) }], CLOSE + MIN);
  assert.equal(p.phase, "ended");
  assert.equal(p.update, null);
});

test("unknown questions and options are refused, and a question not in this student's paper is refused", () => {
  const drawn = attempt({ questionIds: ["q1"] });
  const p = planSync(drawn, exam, [
    { questionId: "q2", choice: "A" },          // not in this student's draw
    { questionId: "zzz", choice: "A" },          // does not exist
    { questionId: "q1", choice: "F" },           // no such option
    { questionId: "q1", choice: "B" },           // fine
  ], DEADLINE - MIN);
  assert.equal(p.accepted, 1);
  assert.deepEqual(p.rejected.map((r) => r.reason), ["unknown_question", "unknown_question", "unknown_option"]);
});

test("the latest change to a question wins, and clearing an answer removes it", () => {
  const entries = [
    { questionId: "q1", choice: "B", answeredAt: iso(DEADLINE - 5 * MIN) },
    { questionId: "q1", choice: "A", answeredAt: iso(DEADLINE - 2 * MIN) },
    { questionId: "q2", choice: null, answeredAt: iso(DEADLINE - 3 * MIN) },
  ];
  const p = planSync(attempt({ answers: { q2: "B" } }), exam, entries, DEADLINE + MIN);
  assert.equal(p.update.$set["answers.q1"], "A");
  assert.ok("answers.q2" in p.update.$unset);
});

test("un-flagging removes an existing flag", () => {
  const p = planSync(attempt({ flagged: ["q1", "q2"] }), exam, [{ questionId: "q1", flagged: false }], DEADLINE - MIN);
  assert.deepEqual(p.update.$set.flagged, ["q2"]);
});

// ---- end to end with the in-memory model ----
function setup(over = {}) {
  const docs = new Map([["a1", attempt(over)]]);
  const Attempt = fakeAttemptModel(docs);
  const sync = makeSyncer({ Attempt, finalise: makeFinaliser(Attempt) });
  return { docs, sync };
}

test("offline student: answers given before the deadline are scored when they reconnect inside the grace period", async () => {
  const { docs, sync } = setup({ answers: { q1: "A" }, rev: 3 });  // the server already had q1
  const r = await sync(docs.get("a1"), exam, [
    { questionId: "q2", choice: "B", answeredAt: iso(DEADLINE - 4 * MIN) },
    { questionId: "q3", choice: "A", answeredAt: iso(DEADLINE - 1 * MIN) },
  ], new Date(DEADLINE + 5 * MIN));
  assert.equal(r.outcome, "closed");
  assert.equal(r.attempt.status, "submitted");
  assert.equal(r.attempt.score, 4);                // q1 (1) + q2 (2) + q3 (1)
  assert.equal(r.attempt.correct, 3);
  assert.equal(r.attempt.autoSubmitted, true);
  assert.equal(docs.get("a1").lateSynced, true);
});

test("answers dated after the deadline do not count, even inside the grace period", async () => {
  const { docs, sync } = setup();
  const r = await sync(docs.get("a1"), exam, [
    { questionId: "q1", choice: "A", answeredAt: iso(DEADLINE - MIN) },
    { questionId: "q2", choice: "B", answeredAt: iso(DEADLINE + 2 * MIN) },
  ], new Date(DEADLINE + 5 * MIN));
  assert.equal(r.attempt.score, 1);
  assert.equal(r.rejected.length, 1);
});

test("after the grace period the attempt is closed with what the server already had", async () => {
  const { docs, sync } = setup({ answers: { q1: "A" } });
  const r = await sync(docs.get("a1"), exam, [{ questionId: "q2", choice: "B", answeredAt: iso(DEADLINE - MIN) }], new Date(CLOSE + MIN));
  assert.equal(r.outcome, "grace_ended");
  assert.equal(r.attempt.score, 1);
  assert.ok(!docs.get("a1").lateSynced);
});

test("syncing twice returns the same stored result and changes nothing", async () => {
  const { docs, sync } = setup();
  const entries = [{ questionId: "q1", choice: "A", answeredAt: iso(DEADLINE - MIN) }];
  const first = await sync(docs.get("a1"), exam, entries, new Date(DEADLINE + MIN));
  const second = await sync(clone(docs.get("a1")), exam, [{ questionId: "q2", choice: "B", answeredAt: iso(DEADLINE - MIN) }], new Date(DEADLINE + 2 * MIN));
  assert.equal(second.outcome, "already_submitted");
  assert.equal(second.attempt.score, first.attempt.score);
  assert.equal(second.attempt.submittedAt, first.attempt.submittedAt);
});

test("a normal manual submit before the deadline sends pending answers and is not marked auto or late", async () => {
  const { docs, sync } = setup();
  const r = await sync(docs.get("a1"), exam, [{ questionId: "q2", choice: "B" }], new Date(DEADLINE - 5 * MIN));
  assert.equal(r.attempt.score, 2);
  assert.equal(r.attempt.autoSubmitted, false);
  assert.ok(!docs.get("a1").lateSynced);
});

test("an attempt that was closed by someone else mid-sync returns the stored result without overwriting it", async () => {
  const docs = new Map([["a1", attempt()]]);
  const Attempt = fakeAttemptModel(docs, { beforeUpdate: (m) => { m.get("a1").status = "submitted"; m.get("a1").score = 9; } });
  const sync = makeSyncer({ Attempt, finalise: makeFinaliser(Attempt) });
  const r = await sync(docs.get("a1"), exam, [{ questionId: "q1", choice: "A" }], new Date(DEADLINE - MIN));
  assert.equal(r.outcome, "already_submitted");
  assert.equal(r.attempt.score, 9);
});

// ---- wiring ----
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("the sync route is rate limited and validated", () => {
  assert.match(read("routes/cbtRoutes.js"), /\/attempts\/:id\/sync",\s*syncLimiter,\s*validate\(cbt\.syncAnswers\)/);
  assert.match(read("validations/cbtValidation.js"), /syncAnswers/);
});

test("starting an attempt stores the grace period on it, and plain saves are refused (not closed) inside it", () => {
  const src = read("controllers/examController.js");
  assert.match(src, /graceSeconds, closeAt:/);
  assert.match(src, /code: "TIME_UP"/);
});

test("the attempt model carries the grace fields and the late-sync flag", () => {
  const src = read("models/Attempt.js");
  for (const f of ["closeAt", "graceSeconds", "lateSynced", "lateSyncedCount"]) assert.match(src, new RegExp(f));
});
