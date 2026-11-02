const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_GUARD, normalizePolicy, classify, CLIENT_EVENT_TYPES } = require("../utils/guard");
const { makeEventService, makeLogger } = require("../utils/attemptEvents");
const { makeFinaliser } = require("../utils/attemptLifecycle");
const { fakeAttemptModel, fakeEventModel, clone } = require("./helpers/fakeAttemptModel");

const MIN = 60000;
const T0 = Date.UTC(2026, 10, 2, 9, 0, 0);
const iso = (t) => new Date(t).toISOString();
const exam = { guard: undefined, questions: [{ _id: "q1", correctKey: "A", marks: 1, options: [{ key: "A" }, { key: "B" }] }] };
const attempt = (over = {}) => ({ _id: "a1", examId: "e", userId: "u", status: "in_progress", startedAt: iso(T0), deadline: iso(T0 + 30 * MIN), closeAt: iso(T0 + 40 * MIN), answers: {}, rev: 0, violations: 0, ...over });
let n = 0;
const away = (sec, over = {}) => ({ eid: `evt-${++n}-xxxxxxxx`, type: "away", durationMs: sec * 1000, ...over });

function setup(over = {}, examOver = {}) {
  const docs = new Map([["a1", attempt(over)]]);
  const Attempt = fakeAttemptModel(docs);
  const rows = [];
  const AttemptEvent = fakeEventModel(rows);
  const logger = makeLogger(AttemptEvent);
  const finalise = makeFinaliser(Attempt, { onClosed: (a, info) => logger.log(a, "auto_submitted_violations", { reason: info.reason }) });
  const svc = makeEventService({ Attempt, AttemptEvent, finalise });
  const ex = { ...exam, ...examOver };
  return { docs, rows, svc, ex, run: (events, when = T0 + 5 * MIN) => svc.ingest(clone(docs.get("a1")), ex, events, new Date(when)) };
}

test("the defaults: on, focus monitored, 3 violations then automatic submission, no forced fullscreen", () => {
  assert.equal(DEFAULT_GUARD.enabled, true);
  assert.equal(DEFAULT_GUARD.maxViolations, 3);
  assert.equal(DEFAULT_GUARD.autoSubmit, true);
  assert.equal(DEFAULT_GUARD.requireFullscreen, false);
});

test("normalizePolicy fills gaps, clamps numbers and ignores junk", () => {
  assert.deepEqual(normalizePolicy(undefined), { ...DEFAULT_GUARD });
  const p = normalizePolicy({ maxViolations: 99, minAwaySeconds: -4, autoSubmit: "yes", enabled: false });
  assert.equal(p.maxViolations, 20);
  assert.equal(p.minAwaySeconds, 0);
  assert.equal(p.autoSubmit, true);   // not a boolean: default
  assert.equal(p.enabled, false);
  assert.equal(normalizePolicy({ maxViolations: 0 }).maxViolations, 1);
});

test("classify: only a long enough absence counts; network events never do", () => {
  const p = normalizePolicy({});
  assert.equal(classify({ type: "away", durationMs: 1500 }, p), false);   // under 2 seconds
  assert.equal(classify({ type: "away", durationMs: 2000 }, p), true);
  assert.equal(classify({ type: "away" }, p), false);                      // no duration reported
  assert.equal(classify({ type: "offline" }, p), false);
  assert.equal(classify({ type: "online", durationMs: 600000 }, p), false);
  assert.equal(classify({ type: "copy_blocked" }, p), false);
  assert.equal(classify({ type: "fullscreen_exit" }, p), false);           // fullscreen not required by default
  assert.equal(classify({ type: "fullscreen_exit" }, normalizePolicy({ requireFullscreen: true })), true);
  assert.equal(classify({ type: "away", durationMs: 9000 }, normalizePolicy({ monitorFocus: false })), false);
  assert.equal(classify({ type: "away", durationMs: 9000 }, normalizePolicy({ enabled: false })), false);
});

test("the browser may only report the listed event types", () => {
  assert.ok(CLIENT_EVENT_TYPES.includes("away"));
  assert.ok(!CLIENT_EVENT_TYPES.includes("submitted"));
  assert.ok(!CLIENT_EVENT_TYPES.includes("exam_started"));
});

test("first and second violation warn; the third submits the exam", async () => {
  const t = setup({ answers: { q1: "A" } });
  const r1 = await t.run([away(5)]);
  assert.deepEqual([r1.violations, r1.remaining, r1.closed], [1, 2, false]);
  const r2 = await t.run([away(7)]);
  assert.deepEqual([r2.violations, r2.remaining, r2.closed], [2, 1, false]);
  const r3 = await t.run([away(3)]);
  assert.equal(r3.closed, true);
  assert.equal(r3.terminated, true);
  assert.equal(r3.attempt.status, "submitted");
  assert.equal(r3.attempt.submitReason, "violation_limit");
  assert.equal(r3.attempt.score, 1);   // answers already saved are scored
  assert.equal(t.docs.get("a1").autoSubmitted, true);
  assert.ok(t.rows.some((r) => r.type === "auto_submitted_violations"));
});

test("short absences are logged but do not count", async () => {
  const t = setup();
  const r = await t.run([away(1)]);
  assert.equal(r.violations, 0);
  assert.equal(t.rows.length, 1);
  assert.equal(t.rows[0].counted, false);
});

test("a resent event is not counted twice", async () => {
  const t = setup();
  const e = away(5);
  await t.run([e]);
  const again = await t.run([e]);
  assert.equal(again.violations, 1);
  assert.equal(t.rows.filter((r) => r.eid === e.eid).length, 1);
});

test("a batch of events (sent after being offline) is counted together, and closes once", async () => {
  const t = setup();
  const r = await t.run([away(5), away(5), away(5), away(5)]);
  assert.equal(r.terminated, true);
  assert.equal(t.docs.get("a1").status, "submitted");
  assert.equal(t.rows.filter((x) => x.type === "auto_submitted_violations").length, 1);
});

test("automatic submission off: violations are recorded and warned, the exam carries on", async () => {
  const t = setup({ guard: normalizePolicy({ autoSubmit: false }) });
  const r = await t.run([away(5), away(5), away(5), away(5)]);
  assert.equal(r.violations, 4);
  assert.equal(r.closed, false);
  assert.equal(t.docs.get("a1").status, "in_progress");
});

test("a different limit is respected, and the attempt's own policy wins over later edits to the exam", async () => {
  const t = setup({ guard: normalizePolicy({ maxViolations: 2 }) }, { guard: { maxViolations: 10 } });
  await t.run([away(5)]);
  const r = await t.run([away(5)]);
  assert.equal(r.terminated, true);
});

test("an attempt that started before ExamGuard existed uses the exam's policy (defaults)", async () => {
  const t = setup({}, { guard: { maxViolations: 1 } });
  const r = await t.run([away(5)]);
  assert.equal(r.terminated, true);
});

test("guard switched off: nothing counts", async () => {
  const t = setup({ guard: normalizePolicy({ enabled: false }) });
  const r = await t.run([away(60), away(60), away(60), away(60)]);
  assert.equal(r.violations, 0);
  assert.equal(t.docs.get("a1").status, "in_progress");
});

test("fullscreen exits count only when fullscreen is required", async () => {
  const off = setup();
  assert.equal((await off.run([{ eid: "fs-aaaaaaaa", type: "fullscreen_exit" }])).violations, 0);
  const on = setup({ guard: normalizePolicy({ requireFullscreen: true }) });
  assert.equal((await on.run([{ eid: "fs-bbbbbbbb", type: "fullscreen_exit" }])).violations, 1);
});

test("going offline is logged but never a violation", async () => {
  const t = setup();
  const r = await t.run([{ eid: "off-aaaaaaa", type: "offline" }, { eid: "on-aaaaaaaa", type: "online", durationMs: 8 * MIN }]);
  assert.equal(r.violations, 0);
  assert.equal(t.rows.length, 2);
});

test("after the deadline (grace period) events are logged but never counted or used to close", async () => {
  const t = setup();
  const r = await t.run([away(30), away(30), away(30)], T0 + 32 * MIN);
  assert.equal(r.violations, 0);
  assert.equal(r.closed, false);
  assert.equal(t.docs.get("a1").status, "in_progress");
  assert.equal(t.rows.length, 3);
});

test("after the closing time, or once submitted, nothing is recorded", async () => {
  const t = setup();
  const late = await t.run([away(30)], T0 + 50 * MIN);
  assert.equal(late.ignored, true);
  assert.equal(t.rows.length, 0);
  const done = setup({ status: "submitted", violations: 2 });
  const r = await done.run([away(30)]);
  assert.equal(r.closed, true);
  assert.equal(done.rows.length, 0);
});

test("the server log writer never throws", async () => {
  const logger = makeLogger({ create: async () => { throw new Error("db down"); } });
  const orig = console.error; console.error = () => {};
  try { await logger.log({ _id: "a", examId: "e", userId: "u" }, "exam_started"); } finally { console.error = orig; }
});

// ---- wiring ----
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("the events route is rate limited and validated; the admin report is mounted behind the admin check", () => {
  assert.match(read("routes/cbtRoutes.js"), /\/attempts\/:id\/events",\s*eventLimiter,\s*validate\(cbt\.attemptEvents\)/);
  const admin = read("routes/adminRoutes.js");
  assert.ok(admin.indexOf("requireRole(\"admin\")") < admin.indexOf("adminIntegrityRoutes"));
});

test("the exam model and validation both carry the guard settings", () => {
  assert.match(read("models/Exam.js"), /guard:\s*\{\s*type:\s*guardSchema/);
  assert.match(read("validations/cbtValidation.js"), /maxViolations/);
});

test("a running exam is sent the policy but never any answer key", () => {
  const src = read("controllers/examController.js");
  const running = src.slice(src.indexOf("const runningPayload"), src.indexOf("// Loads an attempt only"));
  assert.match(running, /guard:/);
  assert.ok(!/correctKey|explanation/.test(running));
});
