const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeControl, connectionOf, remainingSeconds, MAX_EXTRA_SECONDS } = require("../utils/examControl");
const { phaseOf, makeSyncer } = require("../utils/lateSync");
const { makeFinaliser } = require("../utils/attemptLifecycle");
const { makeSweeper } = require("../utils/attemptSweeper");
const { makeLogger, makeEventService } = require("../utils/attemptEvents");
const { makeCache } = require("../utils/examCache");
const { fakeAttemptModel, fakeEventModel, clone } = require("./helpers/fakeAttemptModel");

const MIN = 60000;
const T0 = Date.UTC(2026, 10, 3, 9, 0, 0);
const iso = (t) => new Date(t).toISOString();
const exam = { questions: [{ _id: "q1", correctKey: "A", marks: 1, options: [{ key: "A" }, { key: "B" }] }, { _id: "q2", correctKey: "B", marks: 1, options: [{ key: "A" }, { key: "B" }] }] };
const attempt = (over = {}) => ({ _id: "a1", examId: "e", userId: "u", status: "in_progress", startedAt: iso(T0), deadline: iso(T0 + 30 * MIN), closeAt: iso(T0 + 40 * MIN), answers: {}, flagged: [], rev: 0, violations: 0, pausedAt: null, ...over });

function setup(over = {}) {
  const docs = new Map([["a1", attempt(over)]]);
  const Attempt = fakeAttemptModel(docs);
  const rows = [];
  const AttemptEvent = fakeEventModel(rows);
  const logger = makeLogger(AttemptEvent);
  const finalise = makeFinaliser(Attempt, { onClosed: (a, info) => logger.log(a, "closed_by_admin", { reason: info.reason }) });
  const control = makeControl({ Attempt, finalise, logger });
  return { docs, rows, Attempt, control, finalise, cur: () => clone(docs.get("a1")) };
}

test("pause stops the clock; resume gives back exactly the time that was left, with the same grace period", async () => {
  const t = setup();
  assert.deepEqual(await t.control.pause(t.cur(), "admin1", "fire drill", new Date(T0 + 10 * MIN)), { ok: true });
  assert.ok(t.docs.get("a1").pausedAt);
  assert.equal(remainingSeconds(t.cur(), T0 + 25 * MIN), 20 * 60); // still 20 minutes, however long the pause lasts
  const r = await t.control.resume(t.cur(), "admin1", new Date(T0 + 15 * MIN));
  assert.deepEqual(r, { ok: true });
  const a = t.docs.get("a1");
  assert.equal(a.pausedAt, null);
  assert.equal(new Date(a.deadline).getTime(), T0 + 35 * MIN);     // 15 min restart + 20 min left
  assert.equal(new Date(a.closeAt).getTime(), T0 + 45 * MIN);       // 10 min grace kept
  assert.equal(a.pausedTotalSeconds, 5 * 60);
  assert.equal(a.pauseCount, 1);
  assert.ok(t.rows.some((r) => r.type === "admin_paused" && r.meta.by === "admin1"));
  assert.ok(t.rows.some((r) => r.type === "admin_resumed"));
});

test("pause and resume refuse impossible requests", async () => {
  const t = setup();
  assert.equal((await t.control.resume(t.cur(), "a", new Date(T0))).code, "NOT_PAUSED");
  assert.equal((await t.control.pause(t.cur(), "a", "", new Date(T0 + 31 * MIN))).code, "TIME_UP");
  await t.control.pause(t.cur(), "a", "", new Date(T0 + 5 * MIN));
  assert.equal((await t.control.pause(t.cur(), "a", "", new Date(T0 + 6 * MIN))).code, "ALREADY_PAUSED");
  const done = setup({ status: "submitted" });
  assert.equal((await done.control.pause(done.cur(), "a", "", new Date(T0))).code, "NOT_RUNNING");
  assert.equal((await done.control.extend(done.cur(), 5, "a", "", new Date(T0))).code, "NOT_RUNNING");
});

test("a paused attempt counts as open, is never closed by the sweeper, and counts no warnings", async () => {
  const t = setup({ pausedAt: iso(T0 + 5 * MIN), deadline: iso(T0 + 30 * MIN), closeAt: iso(T0 + 40 * MIN) });
  assert.equal(phaseOf(t.cur(), T0 + 3 * 3600 * 1000), "open");
  const sweep = makeSweeper({ Attempt: t.Attempt, Exam: { findById: () => ({ lean: async () => exam }) }, finalise: t.finalise, log: { error() {} } });
  const r = await sweep(new Date(T0 + 3 * 3600 * 1000));
  assert.equal(r.found, 0);
  assert.equal(t.docs.get("a1").status, "in_progress");
  const svc = makeEventService({ Attempt: t.Attempt, AttemptEvent: fakeEventModel([]), finalise: t.finalise });
  const out = await svc.ingest(t.cur(), exam, [{ eid: "away-aaaaaaaa", type: "away", durationMs: 60000 }], new Date(T0 + 10 * MIN));
  assert.equal(out.violations, 0);
});

test("after the sweeper's check, an attempt that is not paused and past its closing time is still closed", async () => {
  const t = setup({ deadline: iso(T0 - 20 * MIN), closeAt: iso(T0 - 10 * MIN) });
  const sweep = makeSweeper({ Attempt: t.Attempt, Exam: { findById: () => ({ lean: async () => exam }) }, finalise: t.finalise, log: { error() {} } });
  assert.equal((await sweep(new Date(T0))).closed, 1);
});

test("extend adds time to the deadline and the closing time, also while paused, within limits", async () => {
  const t = setup();
  assert.deepEqual(await t.control.extend(t.cur(), 10, "admin1", "slow computer", new Date(T0 + 5 * MIN)), { ok: true });
  const a = t.docs.get("a1");
  assert.equal(new Date(a.deadline).getTime(), T0 + 40 * MIN);
  assert.equal(new Date(a.closeAt).getTime(), T0 + 50 * MIN);
  assert.equal(a.extraSeconds, 600);
  assert.ok(t.rows.some((r) => r.type === "time_extended" && r.meta.minutes === 10));
  // paused: the remaining time grows
  await t.control.pause(t.cur(), "a", "", new Date(T0 + 10 * MIN));
  const before = remainingSeconds(t.cur(), T0 + 20 * MIN);
  await t.control.extend(t.cur(), 5, "a", "", new Date(T0 + 20 * MIN));
  assert.equal(remainingSeconds(t.cur(), T0 + 20 * MIN), before + 300);
});

test("extend refuses bad minutes, an attempt already past its closing time, and more than 4 hours in total", async () => {
  const t = setup();
  for (const m of [0, -5, 121, 2.5, "x"]) assert.equal((await t.control.extend(t.cur(), m, "a", "", new Date(T0))).code, "BAD_MINUTES");
  assert.equal((await t.control.extend(t.cur(), 5, "a", "", new Date(T0 + 41 * MIN))).code, "TIME_UP");
  const big = setup({ extraSeconds: MAX_EXTRA_SECONDS - 60 });
  assert.equal((await big.control.extend(big.cur(), 5, "a", "", new Date(T0))).code, "LIMIT");
});

test("two administrators extending at once: the second is told the attempt changed (no double add)", async () => {
  const t = setup();
  const stale = t.cur();
  await t.control.extend(t.cur(), 10, "a1", "", new Date(T0));
  const second = await t.control.extend(stale, 10, "a2", "", new Date(T0));
  assert.equal(second.code, "CHANGED");
  assert.equal(t.docs.get("a1").extraSeconds, 600);
});

test("ask-to-submit leaves a command; the sync that follows closes it as admin_forced and keeps the student's answers", async () => {
  const t = setup({ answers: { q1: "A" } });
  assert.deepEqual(await t.control.requestSubmit(t.cur(), "admin1", "end of session", new Date(T0 + 5 * MIN)), { ok: true });
  assert.equal(t.docs.get("a1").adminCommand.type, "submit");
  const sync = makeSyncer({ Attempt: t.Attempt, finalise: t.finalise });
  const r = await sync(t.cur(), exam, [{ questionId: "q2", choice: "B" }], new Date(T0 + 6 * MIN));
  assert.equal(r.attempt.status, "submitted");
  assert.equal(r.attempt.submitReason, "admin_forced");
  assert.equal(r.attempt.score, 2);          // the answer that was waiting on the device counted
});

test("force-now and terminate close immediately with their own reasons, score what the server has, and are logged", async () => {
  const f = setup({ answers: { q1: "A" } });
  const r1 = await f.control.closeNow(f.cur(), exam, "admin1", "force", "ok");
  assert.equal(r1.ok, true);
  assert.equal(f.docs.get("a1").submitReason, "admin_forced");
  assert.equal(f.docs.get("a1").score, 1);
  assert.ok(f.rows.some((r) => r.type === "admin_force_submitted" && r.meta.by === "admin1"));
  const x = setup();
  await x.control.closeNow(x.cur(), exam, "admin2", "terminate");
  assert.equal(x.docs.get("a1").submitReason, "admin_terminated");
  assert.ok(x.rows.some((r) => r.type === "admin_terminated"));
  assert.equal((await x.control.closeNow(x.cur(), exam, "a", "force")).code, "NOT_RUNNING");
});

test("connection status: connected, quiet, disconnected, paused", () => {
  const now = T0 + 10 * MIN;
  assert.equal(connectionOf(attempt({ lastSeenAt: iso(now - 20000) }), now), "online");
  assert.equal(connectionOf(attempt({ lastSeenAt: iso(now - 120000) }), now), "quiet");
  assert.equal(connectionOf(attempt({ lastSeenAt: iso(now - 400000) }), now), "disconnected");
  assert.equal(connectionOf(attempt({ lastSeenAt: iso(now - 400000), lastSavedAt: iso(now - 10000) }), now), "online"); // a saved answer is a sign of life
  assert.equal(connectionOf(attempt({ pausedAt: iso(now - 1000) }), now), "paused");
});

test("remainingSeconds: counts down, never below zero, frozen while paused", () => {
  assert.equal(remainingSeconds(attempt(), T0 + 29 * MIN), 60);
  assert.equal(remainingSeconds(attempt(), T0 + 99 * MIN), 0);
  assert.equal(remainingSeconds(attempt({ pausedAt: iso(T0 + 10 * MIN) }), T0 + 99 * MIN), 20 * 60);
});

test("the exam-keys cache keeps an exam for its time limit, drops it after, and never remembers 'not found'", async () => {
  const cache = makeCache(1000);
  let loads = 0;
  const loader = async () => { loads++; return { id: 1 }; };
  await cache.get("e1", loader, 0); await cache.get("e1", loader, 500);
  assert.equal(loads, 1);
  await cache.get("e1", loader, 1500);
  assert.equal(loads, 2);
  let misses = 0;
  await cache.get("gone", async () => { misses++; return null; }, 0); await cache.get("gone", async () => { misses++; return null; }, 1);
  assert.equal(misses, 2);
  const small = makeCache(1000, 2);
  await small.get("a", loader, 0); await small.get("b", loader, 0); await small.get("c", loader, 0);
  assert.equal(small.size, 2);
});

// ---- wiring ----
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("the heartbeat route is rate limited; the control routes sit behind the admin check", () => {
  assert.match(read("routes/cbtRoutes.js"), /\/attempts\/:id\/heartbeat",\s*beatLimiter,\s*c\.heartbeat/);
  assert.match(read("routes/adminIntegrityRoutes.js"), /\/control",\s*require\("\.\/adminControlRoutes"\)/);
  const admin = read("routes/adminRoutes.js");
  assert.ok(admin.indexOf('requireRole("admin")') < admin.indexOf("adminIntegrityRoutes"));
});

test("answer saving loads only question ids and option letters, from the cache, and refuses while paused", () => {
  const src = read("controllers/examController.js");
  const save = src.slice(src.indexOf("exports.saveAnswer"), src.indexOf("// POST /api/attempts/:id/sync"));
  assert.match(src, /select\("questions\._id questions\.options\.key"\)/);
  assert.match(save, /examKeys\.get\(/);
  assert.match(save, /code: "PAUSED"/);
  assert.ok(!/Exam\.findById\(attempt\.examId\)\.lean\(\);\s*\n\s*if \(!exam\) return res\.status\(404\)[^]*?const \{ questionId/.test(save.replace(/const full[^]*?\n/, "")), "a whole-exam load before the update");
});

test("the sweeper never touches a paused attempt, and no admin endpoint is open to students", () => {
  assert.match(read("utils/attemptSweeper.js"), /pausedAt: null/);
  assert.match(read("routes/adminControlRoutes.js"), /Mounted under \/api\/admin/);
});

test("the control actions are all written to the activity log with the administrator", () => {
  const src = read("utils/examControl.js");
  for (const t of ["admin_paused", "admin_resumed", "time_extended", "admin_force_requested", "admin_force_submitted", "admin_terminated"]) assert.match(src, new RegExp(t));
});
