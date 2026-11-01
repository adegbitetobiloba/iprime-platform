// Selecting questions for an exam: the pure engine, then the REAL bankController.select against in-memory data.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("./helpers/fakeDb");
const { selectQuestions, apportion } = require("../utils/selection");
const c = require("../controllers/bankController");

const TOPICS = ["Mechanics", "Waves", "Electricity"];
const pool = [];
TOPICS.forEach((t) => { for (let i = 0; i < 30; i++) pool.push({ id: `${t}-${i}`, topic: t, difficulty: ["easy", "medium", "hard", null][i % 4] }); });

test("the brief's example: 40 questions from 3 topics, mixed difficulty, random (200 random runs, always exact and balanced)", () => {
  for (let n = 0; n < 200; n++) {
    const r = selectQuestions(pool, { count: 40, topics: TOPICS, difficulty: { mode: "mix" } });
    assert.equal(r.picked.length, 40); assert.equal(r.shortfall, 0);
    assert.equal(new Set(r.picked.map((q) => q.id)).size, 40, "no duplicates");
    const t = Object.values(r.breakdown.byTopic);
    assert.ok(Math.max(...t) - Math.min(...t) <= 1, `topics drifted: ${JSON.stringify(r.breakdown.byTopic)}`);
    assert.deepEqual(r.breakdown.byDifficulty, { easy: 12, medium: 20, hard: 8 }); // 30 / 50 / 20
  }
});

test("only the requested topics are used", () => {
  const r = selectQuestions(pool, { count: 20, topics: ["Waves"] });
  assert.ok(r.picked.every((q) => q.topic === "Waves"));
});

test("manual and random combine: manual picks are kept, the rest filled randomly up to the count", () => {
  const manual = ["Waves-0", "Waves-1", "Mechanics-5"];
  const r = selectQuestions(pool, { count: 10, topics: ["Mechanics", "Waves"], manualIds: manual });
  assert.equal(r.picked.length, 10); assert.equal(r.manualCount, 3);
  assert.ok(manual.every((id) => r.picked.some((q) => q.id === id)), "every manual pick is kept");
  assert.equal(new Set(r.picked.map((q) => q.id)).size, 10);
});

test("a manual pick outside the chosen topics is still honoured (the administrator asked for it)", () => {
  const r = selectQuestions(pool, { count: 5, topics: ["Waves"], manualIds: ["Electricity-3"] });
  assert.ok(r.picked.some((q) => q.id === "Electricity-3")); assert.equal(r.picked.length, 5);
});

test("manual picks that are not eligible are reported, never silently dropped or invented", () => {
  const r = selectQuestions(pool, { count: 5, manualIds: ["nope-1", "Waves-2"] });
  assert.ok(r.notes.some((n) => n.code === "MANUAL_NOT_ELIGIBLE" && n.id === "nope-1"));
  assert.ok(r.picked.some((q) => q.id === "Waves-2"));
});

test("more manual picks than the count: all manual picks kept and the user is told", () => {
  const r = selectQuestions(pool, { count: 2, manualIds: ["Waves-0", "Waves-1", "Waves-2"] });
  assert.equal(r.picked.length, 3); assert.ok(r.notes.some((n) => n.code === "MANUAL_EXCEEDS_COUNT"));
});

test("a shortfall is reported honestly, never padded with other topics", () => {
  const r = selectQuestions(pool, { count: 50, topics: ["Waves"] });
  assert.equal(r.picked.length, 30); assert.equal(r.shortfall, 20);
  assert.ok(r.notes.some((n) => n.code === "SHORTFALL" && n.wanted === 50 && n.got === 30));
  assert.ok(r.picked.every((q) => q.topic === "Waves"));
});

test("a topic with no eligible questions is named", () => {
  const r = selectQuestions(pool, { count: 5, topics: ["Waves", "Optics"] });
  assert.ok(r.notes.some((n) => n.code === "TOPIC_EMPTY" && n.topic === "Optics"));
});

test("difficulty mix with no difficulty data: says so and still fills from unrated questions", () => {
  const bare = pool.map((q) => ({ ...q, difficulty: null }));
  const r = selectQuestions(bare, { count: 12, difficulty: { mode: "mix" } });
  assert.equal(r.picked.length, 12);
  assert.ok(r.notes.some((n) => n.code === "NO_DIFFICULTY_DATA"));
});

test("a custom mix is respected and rated questions come before unrated ones", () => {
  const r = selectQuestions(pool, { count: 20, difficulty: { mode: "mix", mix: { easy: 0, medium: 0, hard: 100 } } });
  assert.equal(r.breakdown.byDifficulty.hard, 20);
});

test("excluded questions are never chosen; the same seed repeats, a new seed differs", () => {
  const ex = pool.slice(0, 60).map((q) => q.id);
  const r = selectQuestions(pool, { count: 30, excludeIds: ex });
  assert.ok(r.picked.every((q) => !ex.includes(q.id)));
  const a = selectQuestions(pool, { count: 30, seed: "s1" }).picked.map((q) => q.id).join();
  assert.equal(a, selectQuestions(pool, { count: 30, seed: "s1" }).picked.map((q) => q.id).join());
  assert.notEqual(a, selectQuestions(pool, { count: 30, seed: "s2" }).picked.map((q) => q.id).join());
});

test("apportion always adds up exactly", () => {
  for (let n = 0; n < 200; n++) { const p = apportion(n, { easy: 30, medium: 50, hard: 20 }); assert.equal(p.easy + p.medium + p.hard, n); }
});

// ---- the real controller ----
const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ user: { id: "admin1" }, body: {}, params: {}, query: {}, ...req }, r); return r; };
const opts = [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }, { key: "D", text: "d" }];
const item = (n, topic, over = {}) => ({ externalId: `PHY-${String(n).padStart(4, "0")}`, subject: "Physics", topic, text: `Physics question ${n}`, options: opts, correctKey: "B", explanation: "Because.", ...over });
const body = (over = {}) => ({ topics: [], manualIds: [], excludeIds: [], verifiedOnly: false, balanceTopics: true, ...over });
beforeEach(() => db.reset());

async function seedBank() {
  const qs = []; let n = 0;
  for (const t of TOPICS) for (let i = 0; i < 20; i++) qs.push(item(++n, t, i % 3 === 0 ? { difficulty: "Easy" } : i % 3 === 1 ? { difficulty: "hard" } : {}));
  qs.push(item(++n, "Mechanics", { correctKey: null }));         // incomplete: must never be selected
  qs.push(item(++n, "Optics", { subject: "Chemistry" }));         // other subject
  const r = await call(c.importBatch, { body: { sessionId: "sess-sel-0001", questions: qs, allowIncomplete: true, onConflict: "skip" } });
  assert.equal(r.body.created, qs.length);
}

test("controller: picks the requested number from the chosen subject and topics, never incomplete or other-subject questions", async () => {
  await seedBank();
  const r = await call(c.select, { body: body({ subject: "Physics", topics: TOPICS, count: 40 }) });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.selected, 40); assert.equal(r.body.shortfall, 0);
  assert.equal(new Set(r.body.questions.map((q) => q.id)).size, 40);
  assert.ok(r.body.questions.every((q) => q.subject === "Physics" && TOPICS.includes(q.topic)));
  const incompleteId = db.bankDocs.find((d) => d.usable === false)._id;
  assert.ok(!r.body.questions.some((q) => q.id === incompleteId));
  assert.equal(r.body.available.total, 60); // 60 usable Physics questions available
  assert.ok(!JSON.stringify(r.body).includes("correctKey"), "the preview never exposes answer keys");
});

test("controller: difficulty is read from the field, or from a Difficulty column kept in extra by an earlier import", async () => {
  await seedBank();
  const viaExtra = db.bankDocs.find((d) => d.externalId === "PHY-0003"); // i % 3 === 2: no field set
  viaExtra.extra = { Difficulty: "Moderate" };
  const r = await call(c.select, { body: body({ subject: "Physics", count: 60 }) });
  const levels = r.body.available.byDifficulty;
  assert.ok(levels.easy > 0 && levels.hard > 0 && levels.medium >= 1);
  assert.equal(levels.easy + levels.medium + levels.hard + levels.unrated, 60);
  assert.equal(r.body.questions.find((q) => q.externalId === "PHY-0003").difficulty, "medium");
});

test("controller: verified-only excludes unverified questions, including unverified manual picks", async () => {
  await seedBank();
  const phys = db.bankDocs.filter((d) => d.subject === "Physics" && d.usable);
  phys.slice(0, 10).forEach((d) => { d.verification = { status: "verified" }; });
  const r = await call(c.select, { body: body({ subject: "Physics", count: 30, verifiedOnly: true, manualIds: [phys[15]._id, phys[2]._id] }) });
  assert.equal(r.body.selected, 10); assert.equal(r.body.shortfall, 20);
  assert.ok(r.body.questions.every((q) => q.verified));
  assert.ok(r.body.notes.some((n) => n.code === "MANUAL_NOT_ELIGIBLE" && n.id === phys[15]._id));
});

test("controller: warns about unverified questions and ones that keep their option order", async () => {
  await seedBank();
  const d = db.bankDocs.find((x) => x.externalId === "PHY-0001");
  d.options = [{ key: "A", text: "x" }, { key: "B", text: "y" }, { key: "C", text: "All of the above" }];
  const r = await call(c.select, { body: body({ subject: "Physics", count: 60 }) });
  assert.equal(r.body.warnings.unverified, 60);
  assert.equal(r.body.warnings.fixedOptions, 1);
});

test("controller: what was previewed can be added to a draft exam, with answer keys and bank links intact", async () => {
  await seedBank();
  const sel = await call(c.select, { body: body({ subject: "Physics", topics: ["Waves"], count: 15 }) });
  const exam = db.newExam();
  const add = await call(c.addToExam, { body: { examId: exam._id, ids: sel.body.questions.map((q) => q.id) } });
  assert.equal(add.body.added, 15); assert.equal(exam.questions.length, 15);
  assert.ok(exam.questions.every((q) => q.correctKey === "B" && q.topic === "Waves" && q.bankId));
});

test("controller: a request for more than exist reports the shortfall and what was available", async () => {
  await seedBank();
  const r = await call(c.select, { body: body({ subject: "Physics", topics: ["Waves"], count: 100 }) });
  assert.equal(r.body.selected, 20); assert.equal(r.body.shortfall, 80);
  assert.deepEqual(r.body.available.byTopic, [{ name: "Waves", count: 20 }]);
});

test("controller: marks can be set for every question added in one go; without it each keeps its own", async () => {
  await seedBank();
  const sel = await call(c.select, { body: body({ subject: "Physics", count: 6 }) });
  const ids = sel.body.questions.map((q) => q.id);
  const a = db.newExam(); await call(c.addToExam, { body: { examId: a._id, ids, marks: 2.5 } });
  assert.ok(a.questions.length === 6 && a.questions.every((q) => q.marks === 2.5));
  const b = db.newExam(); await call(c.addToExam, { body: { examId: b._id, ids } });
  assert.ok(b.questions.every((q) => q.marks === 1));
});

test("controller: a published exam or one with attempts refuses new questions, so a live exam cannot change", async () => {
  await seedBank();
  const sel = await call(c.select, { body: body({ subject: "Physics", count: 3 }) });
  const ids = sel.body.questions.map((q) => q.id);
  const live = db.newExam({ status: "published" });
  const r1 = await call(c.addToExam, { body: { examId: live._id, ids } });
  assert.equal(r1.statusCode, 409); assert.equal(live.questions.length, 0);
  const used = db.newExam(); db.attemptsFor().add(used._id);
  const r2 = await call(c.addToExam, { body: { examId: used._id, ids } });
  assert.equal(r2.statusCode, 409);
});

test("controller: a GROUP of question banks (several subjects) can be selected together and balanced by subject", async () => {
  await seedBank();
  const chem = []; for (let i = 0; i < 20; i++) chem.push(item(500 + i, "Atoms", { subject: "Chemistry", externalId: `CHM-${i}` }));
  const bio = []; for (let i = 0; i < 20; i++) bio.push(item(600 + i, "Cells", { subject: "Biology", externalId: `BIO-${i}` }));
  await call(c.importBatch, { body: { sessionId: "sess-sel-0002", questions: [...chem, ...bio], allowIncomplete: true, onConflict: "skip" } });
  const r = await call(c.select, { body: body({ subjects: ["Physics", "Chemistry", "Biology"], count: 30, balanceBy: "subject" }) });
  assert.equal(r.body.selected, 30);
  assert.deepEqual(Object.values(r.body.breakdown.bySubject).sort(), [10, 10, 10]);
  assert.ok(r.body.questions.every((q) => ["Physics", "Chemistry", "Biology"].includes(q.subject)));
  const two = await call(c.select, { body: body({ subjects: ["Chemistry", "Biology"], count: 40 }) });
  assert.equal(two.body.selected, 40); assert.ok(two.body.questions.every((q) => q.subject !== "Physics"));
  assert.equal(two.body.available.total, 41); // 20 Biology + 20 imported Chemistry + the 1 Chemistry question already in the seeded bank
});

test("controller: questions added to an exam keep their subject and difficulty so a pool can be drawn evenly", async () => {
  await seedBank();
  const sel = await call(c.select, { body: body({ subject: "Physics", count: 12, difficulty: { mode: "mix" } }) });
  const exam = db.newExam();
  await call(c.addToExam, { body: { examId: exam._id, ids: sel.body.questions.map((q) => q.id) } });
  assert.ok(exam.questions.every((q) => q.subject === "Physics"));
  assert.ok(exam.questions.some((q) => q.difficulty === "easy") && exam.questions.some((q) => q.difficulty === "hard"));
});
