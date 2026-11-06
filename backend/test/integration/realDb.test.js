// Tests against a REAL MongoDB. The other tests use in-memory stand-ins, which cannot prove that MongoDB itself accepts
// the update operators, indexes and queries the exam code relies on. These do.
//
// Not part of `npm test` (which only runs test/*.test.js). Run with a database you do not mind being emptied:
//   MONGO_URI_TEST=mongodb://localhost:27017/iprime_test node --test test/integration/*.test.js
// In CI this runs from .github/workflows/integration.yml against a throwaway MongoDB container.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const URI = process.env.MONGO_URI_TEST;
const skip = URI ? false : "set MONGO_URI_TEST to run the real-database tests";

const Attempt = require("../../models/Attempt");
const AttemptEvent = require("../../models/AttemptEvent");
const Exam = require("../../models/Exam");
const { makeFinaliser } = require("../../utils/attemptLifecycle");
const { makeSyncer } = require("../../utils/lateSync");
const { makeSweeper } = require("../../utils/attemptSweeper");
const { makeLogger, makeEventService } = require("../../utils/attemptEvents");
const { makeControl } = require("../../utils/examControl");
const pool = require("../../utils/pool");
const { listPipeline } = require("../../utils/examList");
const { purgeOldEvents } = require("../../utils/retention");

const MIN = 60000;
const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  if (skip) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 30000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([Attempt.init(), AttemptEvent.init(), Exam.init()]); // builds the indexes
});
after(async () => {
  if (skip) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function makeExam() {
  const e = await Exam.create({
    title: "Integration", subject: "Maths", durationMinutes: 30, status: "published",
    questions: [
      { text: "Q1", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], correctKey: "A" },
      { text: "Q2", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }], correctKey: "B", marks: 2 },
    ],
  });
  return e.toObject();
}
async function makeAttempt(exam, over = {}) {
  const now = Date.now();
  const a = await Attempt.create({ examId: exam._id, userId: oid(), startedAt: new Date(now - 10 * MIN), deadline: new Date(now + 20 * MIN), closeAt: new Date(now + 30 * MIN), ...over });
  return a.toObject();
}
const save = (a, qid, key) => Attempt.updateOne({ _id: a._id }, { $inc: { rev: 1, saveCount: 1 }, $set: { lastSavedAt: new Date(), [`answers.${qid}`]: key } });
const setup = () => {
  const logger = makeLogger(AttemptEvent);
  const finalise = makeFinaliser(Attempt, { onClosed: (a, info) => logger.log(a, "closed", { reason: info.reason }) });
  return { logger, finalise };
};

test("the indexes MongoDB was asked to build exist (one in-progress attempt per student, sweeper lookups, unique event ids)", { skip }, async () => {
  const attemptIdx = await Attempt.collection.indexes();
  assert.ok(attemptIdx.some((i) => i.unique && i.partialFilterExpression && i.key.examId && i.key.userId), "unique in-progress index");
  assert.ok(attemptIdx.some((i) => i.key.closeAt && i.partialFilterExpression), "closeAt sweeper index");
  const eventIdx = await AttemptEvent.collection.indexes();
  assert.ok(eventIdx.some((i) => i.unique && i.key.attemptId && i.key.eid), "unique event id index");
});

test("a student cannot have two attempts in progress for one exam", { skip }, async () => {
  const exam = await makeExam();
  const first = await makeAttempt(exam);
  await assert.rejects(() => Attempt.create({ examId: exam._id, userId: first.userId, startedAt: new Date(), deadline: new Date(Date.now() + MIN) }), (e) => e.code === 11000);
});

test("saving answers with the real operators, then closing, scores exactly what is stored", { skip }, async () => {
  const exam = await makeExam();
  const a = await makeAttempt(exam);
  await save(a, exam.questions[0]._id, "A");
  await save(a, exam.questions[1]._id, "B");
  const { finalise } = setup();
  const done = await finalise(await Attempt.findById(a._id).lean(), exam, false);
  assert.equal(done.status, "submitted");
  assert.equal(done.score, 3);
  assert.equal(done.submitReason, "student");
  const again = await finalise(await Attempt.findById(a._id).lean(), exam, true);
  assert.equal(again.score, 3);
  assert.equal(again.autoSubmitted, false); // the first close stands
});

test("a save that lands after the score was read is included (the rev guard works on MongoDB)", { skip }, async () => {
  const exam = await makeExam();
  const a = await makeAttempt(exam);
  const stale = await Attempt.findById(a._id).lean(); // read before the answer arrives
  await save(a, exam.questions[1]._id, "B");
  const { finalise } = setup();
  const done = await finalise(stale, exam, false);
  assert.equal(done.score, 2);
});

test("offline sync inside the grace period applies dotted $set/$unset and flags the attempt", { skip }, async () => {
  const exam = await makeExam();
  const now = Date.now();
  const a = await makeAttempt(exam, { startedAt: new Date(now - 35 * MIN), deadline: new Date(now - 5 * MIN), closeAt: new Date(now + 5 * MIN) });
  await save(a, exam.questions[0]._id, "B"); // an earlier (wrong) answer the device later changes
  const { finalise } = setup();
  const sync = makeSyncer({ Attempt, finalise });
  const r = await sync(await Attempt.findById(a._id).lean(), exam, [
    { questionId: String(exam.questions[0]._id), choice: "A", answeredAt: new Date(now - 8 * MIN).toISOString() },
    { questionId: String(exam.questions[1]._id), choice: "B", flagged: true, answeredAt: new Date(now - 7 * MIN).toISOString() },
    { questionId: String(exam.questions[1]._id), choice: "A", answeredAt: new Date(now - 1 * MIN).toISOString() }, // after the deadline: refused
  ], new Date(now));
  assert.equal(r.outcome, "closed");
  assert.equal(r.attempt.score, 3);
  assert.equal(r.attempt.lateSynced, true);
  assert.equal(r.rejected.length, 1);
  assert.deepEqual((await Attempt.findById(a._id).lean()).flagged, [String(exam.questions[1]._id)]);
});

test("reports are counted once even if resent, and the limit closes the attempt on MongoDB", { skip }, async () => {
  const exam = await makeExam();
  const a = await makeAttempt(exam);
  const { finalise } = setup();
  const svc = makeEventService({ Attempt, AttemptEvent, finalise });
  const e1 = { eid: "real-evt-0001", type: "away", durationMs: 5000 };
  const cur = () => Attempt.findById(a._id).lean();
  await svc.ingest(await cur(), exam, [e1]);
  const again = await svc.ingest(await cur(), exam, [e1]);
  assert.equal(again.violations, 1);
  await svc.ingest(await cur(), exam, [{ eid: "real-evt-0002", type: "away", durationMs: 5000 }]);
  const last = await svc.ingest(await cur(), exam, [{ eid: "real-evt-0003", type: "away", durationMs: 5000 }]);
  assert.equal(last.terminated, true);
  const final = await cur();
  assert.equal(final.status, "submitted");
  assert.equal(final.submitReason, "violation_limit");
  assert.equal(await AttemptEvent.countDocuments({ attemptId: a._id, type: "away", counted: true }), 3);
});

test("the sweeper query closes expired attempts, leaves graced and paused ones, and handles attempts with no closeAt", { skip }, async () => {
  const exam = await makeExam();
  const now = Date.now();
  const legacy = await makeAttempt(exam, { deadline: new Date(now - 5 * MIN), closeAt: undefined });
  const over = await makeAttempt(exam, { deadline: new Date(now - 20 * MIN), closeAt: new Date(now - 10 * MIN) });
  const graced = await makeAttempt(exam, { deadline: new Date(now - 5 * MIN), closeAt: new Date(now + 5 * MIN) });
  const paused = await makeAttempt(exam, { deadline: new Date(now - 5 * MIN), closeAt: new Date(now - 1 * MIN), pausedAt: new Date(now - 6 * MIN) });
  const { finalise } = setup();
  const sweep = makeSweeper({ Attempt, Exam, finalise, log: { error() {} } });
  await sweep(new Date(now));
  const status = async (x) => (await Attempt.findById(x._id).lean()).status;
  assert.equal(await status(legacy), "submitted");
  assert.equal(await status(over), "submitted");
  assert.equal(await status(graced), "in_progress");
  assert.equal(await status(paused), "in_progress");
});

test("pause, resume and extend work with real date matching, and resume returns exactly the time left", { skip }, async () => {
  const exam = await makeExam();
  const a = await makeAttempt(exam);
  const logger = makeLogger(AttemptEvent);
  const control = makeControl({ Attempt, finalise: setup().finalise, logger });
  const cur = () => Attempt.findById(a._id).lean();
  const t0 = new Date();
  assert.deepEqual(await control.pause(await cur(), "admin", "test", t0), { ok: true });
  assert.ok((await cur()).pausedAt);
  assert.equal((await control.pause(await cur(), "admin", "", t0)).code, "ALREADY_PAUSED");
  const leftMs = new Date(a.deadline).getTime() - t0.getTime();
  const later = new Date(t0.getTime() + 7 * MIN);
  assert.deepEqual(await control.resume(await cur(), "admin", later), { ok: true });
  const after = await cur();
  assert.equal(after.pausedAt, null);
  assert.equal(new Date(after.deadline).getTime(), later.getTime() + leftMs);
  assert.deepEqual(await control.extend(await cur(), 10, "admin", "", later), { ok: true });
  assert.equal(new Date((await cur()).deadline).getTime(), later.getTime() + leftMs + 10 * MIN);
  assert.equal((await cur()).extraSeconds, 600);
  assert.equal(await AttemptEvent.countDocuments({ attemptId: a._id, type: { $in: ["admin_paused", "admin_resumed", "time_extended"] } }), 3);
});

test("question usage comes from one grouped query and matches the earlier way of counting", { skip }, async () => {
  const exam = await makeExam();
  const [q1, q2] = exam.questions.map((q) => String(q._id));
  const me = oid(), other = oid();
  await Attempt.create({ examId: exam._id, userId: me, status: "submitted", startedAt: new Date(), deadline: new Date(), questionIds: [q1, q2] });
  await Attempt.create({ examId: exam._id, userId: other, status: "submitted", startedAt: new Date(), deadline: new Date(), questionIds: [q1] });
  await Attempt.create({ examId: exam._id, userId: oid(), startedAt: new Date(), deadline: new Date(Date.now() + MIN) }); // no draw: ignored
  const fast = await pool.loadUsage(Attempt, exam._id, String(me));
  assert.deepEqual(fast.usage, { [q1]: 2, [q2]: 1 });
  assert.deepEqual(fast.seenIds.sort(), [q1, q2].sort());
  const slow = await pool.loadUsage({ find: (f) => Attempt.find(f) }, exam._id, String(me)); // the fallback path (no aggregate)
  assert.deepEqual(slow.usage, fast.usage);
  assert.deepEqual(slow.seenIds.sort(), fast.seenIds.sort());
});

test("the exam list query returns counts and marks without the questions, only for open published exams", { skip }, async () => {
  await Exam.deleteMany({});
  const open = await Exam.create({ title: "Open", subject: "S", durationMinutes: 10, status: "published", questions: [
    { text: "a", options: [{ key: "A", text: "x" }, { key: "B", text: "y" }], correctKey: "A", marks: 2 },
    { text: "b", options: [{ key: "A", text: "x" }, { key: "B", text: "y" }], correctKey: "A" },
  ] });
  await Exam.create({ title: "Draft", subject: "S", durationMinutes: 10, status: "draft", questions: [] });
  await Exam.create({ title: "Closed", subject: "S", durationMinutes: 10, status: "published", availableUntil: new Date(Date.now() - 60000), questions: [] });
  const rows = await Exam.aggregate(listPipeline(new Date()));
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0]._id), String(open._id));
  assert.equal(rows[0].poolSize, 2);
  assert.equal(rows[0].marks, 3);              // 2 + the default of 1
  assert.equal(rows[0].questions, undefined);  // the questions are not sent
  assert.equal(pool.shapeFromTotals(rows[0], rows[0].poolSize, rows[0].marks).questionCount, 2);
});

test("the retention purge deletes only old activity records", { skip }, async () => {
  const attemptId = oid(), base = { attemptId, examId: oid(), userId: oid(), type: "away", source: "server" };
  await AttemptEvent.create({ ...base, at: new Date(Date.now() - 400 * 24 * 3600 * 1000) });
  await AttemptEvent.create({ ...base, at: new Date(Date.now() - 10 * 24 * 3600 * 1000) });
  const r = await purgeOldEvents(AttemptEvent, 365);
  assert.equal(r.deleted, 1);
  assert.equal(await AttemptEvent.countDocuments({ attemptId }), 1);
  assert.equal((await purgeOldEvents(AttemptEvent, 0)).skipped, true);
});
