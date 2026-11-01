// Randomisation: pure logic, then the REAL examController end to end against in-memory stand-ins for the database.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const R = require("../utils/randomise");
const { scoreAttempt } = require("../utils/cbt");

const hex = (n) => String(n).padStart(24, "0");
const mk = (n, over = {}) => ({
  _id: hex(n), text: `Question ${n}`, marks: 1, correctKey: ["A", "B", "C", "D"][n % 4],
  options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: `q${n}-opt-${k}` })), ...over,
});
const questions = Array.from({ length: 20 }, (_, i) => mk(i + 1));
const correctText = (q) => q.options.find((o) => o.key === q.correctKey).text;

test("same seed gives the same arrangement; different seeds give different ones", () => {
  const s = { seed: "abc123", shuffleQuestions: true, shuffleOptions: true };
  const a = R.arrange(questions, s).map((e) => [e.q._id, e.options.map((o) => o.key).join("")]);
  const b = R.arrange(questions, s).map((e) => [e.q._id, e.options.map((o) => o.key).join("")]);
  assert.deepEqual(a, b);
  const orders = new Set();
  for (let i = 0; i < 50; i++) orders.add(R.arrange(questions, { ...s, seed: R.newSeed() }).map((e) => e.q._id).join(","));
  assert.ok(orders.size >= 49, `only ${orders.size} distinct orders in 50 attempts`);
});

test("answer mapping survives option shuffling: the option with the correct key is always the same text, for 300 seeds", () => {
  for (let i = 0; i < 300; i++) {
    const arr = R.arrange(questions, { seed: R.newSeed(), shuffleQuestions: true, shuffleOptions: true });
    assert.equal(arr.length, questions.length);
    for (const e of arr) {
      assert.equal(e.options.find((o) => o.key === e.q.correctKey).text, correctText(e.q));
      assert.deepEqual(e.options.map((o) => o.key).sort(), ["A", "B", "C", "D"]);
      assert.deepEqual(e.options.map((o) => o.label), ["A", "B", "C", "D"]); // letters on screen are always A, B, C... in order
      for (const o of e.options) assert.equal(o.text, e.q.options.find((x) => x.key === o.key).text); // text never detaches from its key
    }
  }
});

test("a student who picks the correct TEXT always scores full marks, however it was shuffled", () => {
  for (let i = 0; i < 100; i++) {
    const arr = R.arrange(questions, { seed: R.newSeed(), shuffleQuestions: true, shuffleOptions: true });
    const answers = {};
    for (const e of arr) answers[String(e.q._id)] = e.options.find((o) => o.text === correctText(e.q)).key;
    const r = scoreAttempt(questions, answers);
    assert.deepEqual([r.score, r.correct, r.incorrect, r.unanswered], [20, 20, 0, 0]);
  }
});

test("questions whose options refer to other options are never option-shuffled", () => {
  const refs = ["All of the above", "None of the above", "Both A and B", "A and C only", "I and II only", "I, II and III", "Neither of these", "Both of the above", "Option A is correct", "All of them"];
  for (const t of refs) {
    const q = mk(99, { options: [{ key: "A", text: "x" }, { key: "B", text: "y" }, { key: "C", text: "z" }, { key: "D", text: t }] });
    assert.equal(R.optionsShufflable(q), false, `"${t}" must pin the options`);
    for (let i = 0; i < 20; i++) { const [e] = R.arrange([q], { seed: R.newSeed(), shuffleOptions: true }); assert.deepEqual(e.options.map((o) => o.key), ["A", "B", "C", "D"]); assert.equal(e.moved, false); }
  }
  const plain = ["Hydrogen", "Both nuclei were stable", "Oxygen is the answer"]; // ordinary wording must not be pinned (the middle one is the risky "Both")
  assert.equal(R.optionsShufflable(mk(1)), true);
  assert.equal(R.optionsShufflable(mk(1, { options: [{ key: "A", text: plain[0] }, { key: "B", text: "Carbon" }] })), true);
});

test("switches off, or no seed: nothing moves and letters equal keys", () => {
  for (const s of [{ seed: "x" }, { seed: "x", shuffleQuestions: false, shuffleOptions: false }, { shuffleQuestions: true, shuffleOptions: true }]) {
    const arr = R.arrange(questions, s);
    assert.deepEqual(arr.map((e) => e.q._id), questions.map((q) => q._id));
    for (const e of arr) assert.deepEqual(e.options.map((o) => o.label), e.options.map((o) => o.key));
  }
});

test("no position bias: the correct answer lands in each slot about equally often", () => {
  const q = mk(4, { correctKey: "A" });
  const slots = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) { const [e] = R.arrange([q], { seed: R.newSeed(), shuffleOptions: true }); slots[e.options.findIndex((o) => o.key === "A")]++; }
  for (const n of slots) assert.ok(n > 800 && n < 1200, `slot counts ${slots}`);
});

test("shared-passage questions are detected so the administrator can be warned", () => {
  assert.equal(R.dependsOnNeighbours({ text: "Read the following passage and answer questions 3 to 5." }), true);
  assert.equal(R.dependsOnNeighbours({ text: "According to the passage above, the author is..." }), true);
  assert.equal(R.dependsOnNeighbours({ text: "What is 2 + 2?" }), false);
});

// ---------- the real examController against in-memory models ----------
let attempts, examDoc;
const matchFilter = (d, f) => Object.entries(f).every(([k, v]) => {
  if (v && typeof v === "object" && "$gt" in v) return new Date(d[k]) > v.$gt;
  return String(d[k]) === String(v);
});
const lean = (v) => ({ lean: async () => v, select() { return this; }, sort() { return this; }, limit() { return this; } });
const FakeExam = { findById: (id) => lean(examDoc && String(examDoc._id) === String(id) ? JSON.parse(JSON.stringify(examDoc)) : null), find: () => lean([]) };
const FakeAttempt = {
  findOne: (f) => lean(attempts.find((a) => matchFilter(a, { examId: f.examId, userId: f.userId, status: f.status })) || null),
  findById: (id) => lean(attempts.find((a) => String(a._id) === String(id)) || null),
  countDocuments: async (f) => attempts.filter((a) => a.examId === String(f.examId) && a.userId === f.userId && a.status === f.status).length,
  find: () => lean([]),
  async create(d) { const a = { _id: hex(9000 + attempts.length), answers: {}, flagged: [], ...d, status: "in_progress", examId: String(d.examId) }; attempts.push(a); return { ...a, toObject: () => a }; },
  async updateOne(f, u) {
    const a = attempts.find((x) => String(x._id) === String(f._id));
    if (!a || (f.status && a.status !== f.status) || (f.deadline && !(new Date(a.deadline) > f.deadline.$gt))) return { matchedCount: 0 };
    for (const [k, v] of Object.entries(u.$set || {})) { if (k.startsWith("answers.")) a.answers[k.slice(8)] = v; else a[k] = v; }
    for (const k of Object.keys(u.$unset || {})) delete a.answers[k.slice(8)];
    if (u.$addToSet) a.flagged = [...new Set([...(a.flagged || []), u.$addToSet.flagged])];
    if (u.$pull) a.flagged = (a.flagged || []).filter((x) => x !== u.$pull.flagged);
    return { matchedCount: 1 };
  },
};
const orig = Module._load;
Module._load = function (req, parent, ...rest) {
  if (parent && /controllers[\\/]examController\.js$/.test(parent.filename)) {
    if (req === "mongoose") return { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) };
    if (req === "../models/Exam") return FakeExam;
    if (req === "../models/Attempt") return FakeAttempt;
  }
  return orig.call(this, req, parent, ...rest);
};
const ctl = require("../controllers/examController");
const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ params: {}, body: {}, query: {}, ...req }, r); return r; };
const freshExam = (over = {}) => { attempts = []; examDoc = { _id: hex(500), status: "published", title: "T", subject: "S", durationMinutes: 30, maxAttempts: 3, showAnswersAfter: true, shuffleQuestions: true, shuffleOptions: true, questions: JSON.parse(JSON.stringify(questions)), ...over }; };

test("controller: a started attempt stores its seed and switches; the payload never contains answers", async () => {
  freshExam();
  const r = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  assert.equal(r.statusCode, 201);
  const a = attempts[0];
  assert.ok(a.seed && a.seed.length >= 16); assert.equal(a.shuffleQuestions, true); assert.equal(a.shuffleOptions, true);
  assert.ok(!JSON.stringify(r.body).includes("correctKey"));
  assert.equal(r.body.questions.length, 20);
  assert.notDeepEqual(r.body.questions.map((q) => q.id), questions.map((q) => q._id)); // 20 questions: the chance of an unchanged order is 1 in 2.4 quintillion
});

test("controller: refresh, resume and a second start show the SAME order", async () => {
  freshExam();
  const first = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  const again = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  const reload = await call(ctl.getAttempt, { params: { id: attempts[0]._id }, user: { id: "u1" } });
  const sig = (r) => JSON.stringify(r.body.questions.map((q) => [q.id, q.options.map((o) => o.key + o.label)]));
  assert.equal(sig(first), sig(again)); assert.equal(sig(first), sig(reload));
  assert.equal(attempts.length, 1);
});

test("controller: different students get different sequences", async () => {
  freshExam();
  const seen = new Set();
  for (let i = 0; i < 12; i++) { const r = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: `s${i}` } }); seen.add(r.body.questions.map((q) => q.id).join()); }
  assert.ok(seen.size >= 11, `${seen.size} distinct sequences for 12 students`);
});

test("controller: answer by what you see, submit, and the score and review match what the student saw", async () => {
  freshExam();
  const start = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  const id = attempts[0]._id;
  // The student answers the first 12 on screen: the first 8 correctly (picking the option whose TEXT is right), the next 4 wrongly.
  const shown = start.body.questions;
  const truth = new Map(questions.map((q) => [q._id, q]));
  let expectedScore = 0;
  for (let i = 0; i < 12; i++) {
    const sq = shown[i], real = truth.get(sq.id);
    const right = sq.options.find((o) => o.text === correctText(real));
    const wrong = sq.options.find((o) => o.text !== correctText(real));
    const pick = i < 8 ? right : wrong; if (i < 8) expectedScore++;
    const s = await call(ctl.saveAnswer, { params: { id }, user: { id: "u1" }, body: { questionId: sq.id, choice: pick.key } });
    assert.equal(s.statusCode, 200);
  }
  const sub = await call(ctl.submitAttempt, { params: { id }, user: { id: "u1" } });
  assert.deepEqual([sub.body.result.score, sub.body.result.correct, sub.body.result.incorrect, sub.body.result.unanswered], [expectedScore, 8, 4, 8]);
  const rev = await call(ctl.result, { params: { id }, user: { id: "u1" } });
  assert.deepEqual(rev.body.review.map((q) => q.id), shown.map((q) => q.id)); // review keeps the order the student saw
  rev.body.review.forEach((q, i) => {
    assert.deepEqual(q.options.map((o) => o.label), shown[i].options.map((o) => o.label)); // and the same letters
    assert.equal(q.options.find((o) => o.key === q.correctKey).text, correctText(truth.get(q.id)));
    assert.equal(q.options.find((o) => o.label === q.correctLabel).key, q.correctKey);
  });
});

test("controller: changing the exam's switches after an attempt began does not reshuffle that attempt", async () => {
  freshExam();
  const start = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  examDoc.shuffleQuestions = false; examDoc.shuffleOptions = false;
  const reload = await call(ctl.getAttempt, { params: { id: attempts[0]._id }, user: { id: "u1" } });
  assert.deepEqual(reload.body.questions, start.body.questions);
});

test("controller: attempts that began before this feature existed (no seed) keep the original order", async () => {
  freshExam();
  attempts.push({ _id: hex(7000), examId: examDoc._id, userId: "old", status: "in_progress", startedAt: new Date(), deadline: new Date(Date.now() + 600000), answers: {}, flagged: [] });
  const r = await call(ctl.getAttempt, { params: { id: hex(7000) }, user: { id: "old" } });
  assert.deepEqual(r.body.questions.map((q) => q.id), questions.map((q) => q._id));
  for (const q of r.body.questions) assert.deepEqual(q.options.map((o) => o.label), ["A", "B", "C", "D"]);
});

test("controller: with both switches off the exam behaves exactly as before", async () => {
  freshExam({ shuffleQuestions: false, shuffleOptions: false });
  const r = await call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: "u1" } });
  assert.deepEqual(r.body.questions.map((q) => q.id), questions.map((q) => q._id));
});
