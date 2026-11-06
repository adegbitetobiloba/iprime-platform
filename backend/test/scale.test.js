const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pool = require("../utils/pool");
const { graceSecondsFor } = require("../utils/lateSync");
const { retentionDays, purgeOldEvents, DEFAULT_DAYS, MAX_DAYS } = require("../utils/retention");
const { listPipeline, listRows } = require("../utils/examList");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

// ---- question usage ----
const attempts = [
  { userId: "u1", questionIds: ["a", "b", "c"] },
  { userId: "u2", questionIds: ["a", "b"] },
  { userId: "u3", questionIds: ["a"] },
  { userId: "u1", questionIds: ["d"] },
  { userId: "u4" },                       // no draw
];
const fallbackModel = () => ({ find: () => ({ select: () => ({ lean: async () => attempts }) }) });
function aggregateModel(calls) {
  return {
    async aggregate(pipeline) {
      calls.push(["aggregate", pipeline]);
      const n = {};
      for (const a of attempts) for (const id of a.questionIds || []) n[id] = (n[id] || 0) + 1;
      return Object.entries(n).map(([_id, c]) => ({ _id, n: c }));
    },
    find(f) { calls.push(["find", f]); return { select: () => ({ lean: async () => attempts.filter((a) => a.userId === f.userId) }) }; },
  };
}

test("usage from one grouped query is the same as counting every attempt in memory", async () => {
  const slow = await pool.loadUsage(fallbackModel(), "e1", "u1");
  const calls = [];
  const fast = await pool.loadUsage(aggregateModel(calls), "e1", "u1");
  assert.deepEqual(fast.usage, slow.usage);
  assert.deepEqual(fast.seenIds.sort(), slow.seenIds.sort());
  assert.deepEqual(fast.usage, { a: 3, b: 2, c: 1, d: 1 });
});

test("with a grouped query, only the student's own attempts are loaded into memory", async () => {
  const calls = [];
  await pool.loadUsage(aggregateModel(calls), "e1", "u1");
  const finds = calls.filter((c) => c[0] === "find");
  assert.equal(finds.length, 1);
  assert.equal(finds[0][1].userId, "u1");
  const pipeline = calls.find((c) => c[0] === "aggregate")[1];
  assert.equal(pipeline[0].$match.examId, "e1");
  assert.ok(pipeline.some((s) => s.$unwind) && pipeline.some((s) => s.$group));
});

test("planAttempt draws the least-used questions using the grouped usage", async () => {
  const exam = { _id: "e1", questionsPerStudent: 2, drawSpread: true, drawBalance: false, questions: ["a", "b", "c", "d"].map((id) => ({ _id: id })) };
  const plan = await pool.planAttempt(aggregateModel([]), exam, "u9");
  assert.equal(plan.questionIds.length, 2);
  assert.equal(new Set(plan.questionIds).size, 2);
  assert.ok(plan.questionIds.every((id) => ["a", "b", "c", "d"].includes(id)));
});

test("a list page can work out question count and marks without the questions", () => {
  const cases = [
    { exam: { questions: [{ marks: 2 }, {}, { marks: 0.5 }] } },
    { exam: { questionsPerStudent: 2, questions: [{ marks: 2 }, { marks: 4 }, {}, { marks: 1 }] } },
    { exam: { questionsPerStudent: 10, questions: [{}, {}] } },
    { exam: { questions: [] } },
    { exam: { questionsPerStudent: 1, questions: [{}] } },
  ];
  for (const { exam } of cases) {
    const full = pool.shape(exam);
    const sum = exam.questions.reduce((t, q) => t + (q.marks ?? 1), 0);
    assert.deepEqual(pool.shapeFromTotals(exam, exam.questions.length, sum), full);
  }
});

test("the list query asks only for what the list shows, and the controller uses it", () => {
  const p = listPipeline(new Date());
  assert.equal(p[0].$match.status, "published");
  const proj = p.find((s) => s.$project).$project;
  assert.equal(proj.questions, undefined);
  assert.ok(proj.poolSize && proj.marks);
  const src = read("controllers/examController.js");
  assert.match(src, /listRows\(Exam, now\)/);
  // the student's own paper: marks come from pool.shape arithmetic, never the whole pool's sum
  assert.match(src, /totalMarks: pool\.shapeFromTotals\(e, e\.poolSize, e\.marks\)\.totalMarks/);
});

test("listRows: a real database gets the grouped query; a stand-in without aggregate gets the same rows the earlier way", async () => {
  const exam = { _id: "e1", status: "published", title: "T", questionsPerStudent: 2, questions: [{ marks: 2 }, {}, { marks: 4 }] };
  const stand = { find: () => ({ sort: () => ({ lean: async () => [exam] }) }) };
  const [row] = await listRows(stand, new Date());
  assert.equal(row.poolSize, 3);
  assert.equal(row.marks, 7);
  assert.deepEqual(pool.shapeFromTotals(row, row.poolSize, row.marks), pool.shape(exam)); // 2 questions, about 4.67 marks: THEIR paper
  let piped = null;
  const real = { aggregate: async (pl) => { piped = pl; return [{ _id: "e1", poolSize: 3, marks: 7 }]; }, find: () => { throw new Error("must not load whole exams"); } };
  const rows = await listRows(real, new Date());
  assert.equal(rows.length, 1);
  assert.ok(piped.some((s) => s.$project));
});

// ---- per-exam reconnection window ----
test("the exam's own reconnection window wins; empty uses the server default; 0 switches it off; capped at 60", () => {
  assert.equal(graceSecondsFor({}, {}), 600);
  assert.equal(graceSecondsFor({ reconnectGraceMinutes: null }, {}), 600);
  assert.equal(graceSecondsFor({ reconnectGraceMinutes: 3 }, {}), 180);
  assert.equal(graceSecondsFor({ reconnectGraceMinutes: 0 }, { EXAM_RECONNECT_GRACE_MINUTES: "20" }), 0);
  assert.equal(graceSecondsFor({}, { EXAM_RECONNECT_GRACE_MINUTES: "20" }), 1200);
  assert.equal(graceSecondsFor({ reconnectGraceMinutes: 500 }, {}), 3600);
  assert.equal(graceSecondsFor({ reconnectGraceMinutes: "abc" }, {}), 600);
  assert.equal(graceSecondsFor(null, {}), 600);
});

test("the setting is stored, validated and used when an attempt starts", () => {
  assert.match(read("models/Exam.js"), /reconnectGraceMinutes:\s*\{\s*type:\s*Number,\s*min:\s*0,\s*max:\s*60/);
  assert.match(read("validations/cbtValidation.js"), /reconnectGraceMinutes:\s*Joi\.number\(\)\.integer\(\)\.min\(0\)\.max\(60\)\.allow\(null\)/);
  assert.match(read("controllers/examController.js"), /graceSecondsFor\(exam\)/);
});

// ---- retention ----
test("retention: default 365 days, 0 or junk keeps forever, capped at ten years", () => {
  assert.equal(retentionDays({}), DEFAULT_DAYS);
  assert.equal(retentionDays({ EXAM_EVENT_RETENTION_DAYS: "90" }), 90);
  assert.equal(retentionDays({ EXAM_EVENT_RETENTION_DAYS: "0" }), 0);
  assert.equal(retentionDays({ EXAM_EVENT_RETENTION_DAYS: "forever" }), 0);
  assert.equal(retentionDays({ EXAM_EVENT_RETENTION_DAYS: "99999" }), MAX_DAYS);
});

test("the purge deletes only records older than the cutoff, and nothing when switched off", async () => {
  const seen = [];
  const model = { deleteMany: async (f) => { seen.push(f); return { deletedCount: 7 }; } };
  const now = new Date(Date.UTC(2026, 10, 5));
  const r = await purgeOldEvents(model, 30, now);
  assert.equal(r.deleted, 7);
  assert.equal(seen[0].at.$lt.getTime(), now.getTime() - 30 * 86400000);
  const off = await purgeOldEvents(model, 0, now);
  assert.equal(off.skipped, true);
  assert.equal(seen.length, 1);
});

test("the purge touches only the activity-record collection, runs from the sweeper, and is shown to admins", () => {
  const ret = read("utils/retention.js");
  assert.ok(!/Attempt\./.test(ret.replace(/AttemptEvent/g, "")));
  assert.match(read("utils/attemptSweeper.js"), /startRetention\(AttemptEvent\)/);
  assert.match(read("controllers/adminIntegrityController.js"), /retentionDays: retentionDays\(\)/);
  assert.match(read("models/AttemptEvent.js"), /index\(\{ at: 1 \}\)/);
});

// ---- results wording and keep-alive ----
test("the results page gives the real reason for an automatic submission", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "ResultDetail.jsx"), "utf8");
  for (const r of ["time_up", "violation_limit", "admin_forced", "admin_terminated"]) assert.match(src, new RegExp(r));
  assert.match(src, /whyText\(r\)/);
});

test("the keep-alive does nothing until the owner sets the address, and only in daytime hours", () => {
  const wf = fs.readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "keepalive.yml"), "utf8");
  assert.match(wf, /vars\.API_HEALTH_URL != ''/);
  assert.match(wf, /cron: "\*\/10 5-21 \* \* \*"/);
});
