// Question pools: each student gets their own draw. Pure logic first, then the REAL examController end to end.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const pool = require("../utils/pool");
const R = require("../utils/randomise");
const { scoreAttempt } = require("../utils/cbt");

const hex = (n) => String(n).padStart(24, "0");
const TOPICS = ["Mechanics", "Waves", "Electricity"];
function makePool(perTopic = 100, subject = "Physics") {
  const qs = []; let n = 0;
  for (const t of TOPICS) for (let i = 0; i < perTopic; i++) { n++; qs.push({ _id: hex(n), text: `Q${n}`, topic: t, subject, difficulty: ["easy", "medium", "hard"][i % 3], marks: 1, correctKey: "B", options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: `q${n}-${k}` })) }); }
  return qs;
}
const examOf = (over = {}) => ({ _id: hex(900), status: "published", title: "T", subject: "Physics", durationMinutes: 30, maxAttempts: 3, showAnswersAfter: true, questions: makePool(), questionsPerStudent: 40, ...over });

test("each student's draw has exactly N distinct questions from the pool, balanced across topics", () => {
  const exam = examOf();
  for (let i = 0; i < 100; i++) {
    const ids = pool.drawQuestionIds(exam, { seed: R.newSeed() });
    assert.equal(ids.length, 40); assert.equal(new Set(ids).size, 40);
    const per = TOPICS.map((t) => ids.filter((id) => exam.questions.find((q) => q._id === id).topic === t).length);
    assert.ok(Math.max(...per) - Math.min(...per) <= 1, `topics ${per}`);
  }
});

test("students get different questions: the overlap between two students matches the maths (N*N/pool)", () => {
  const exam = examOf(); let total = 0; const trials = 1500;
  for (let i = 0; i < trials; i++) { const a = pool.drawQuestionIds(exam, { seed: R.newSeed() }), b = new Set(pool.drawQuestionIds(exam, { seed: R.newSeed() })); total += a.filter((x) => b.has(x)).length; }
  const avg = total / trials, expected = pool.expectedOverlap(40, 300);
  assert.ok(Math.abs(avg - expected) < 0.6, `average overlap ${avg.toFixed(2)} vs expected ${expected.toFixed(2)}`);
});

// Simulates students starting one after another, each draw recorded so the next sees what was already handed out.
function enrol(exam, students, base = {}) {
  const usage = {}, papers = [];
  for (let i = 0; i < students; i++) { const ids = pool.drawQuestionIds(exam, { seed: R.newSeed(), usage, ...base }); papers.push(ids); for (const id of ids) usage[id] = (usage[id] || 0) + 1; }
  return { usage, papers };
}

test("SPREAD: with a big enough pool, students get (almost) entirely different papers; no two papers overlap by more than 3", () => {
  const exam = examOf({ questions: makePool(400), questionsPerStudent: 10 }); // pool 1200 = room for 120 students
  const { papers } = enrol(exam, 120);
  assert.ok(new Set(papers.flat()).size >= 1170, `${new Set(papers.flat()).size} of 1200 questions used`); // measured over 150 runs: never below 1188. Topic balance can force a few repeats at the very end
  assert.ok(papers.every((p) => new Set(p).size === 10));
  let worst = 0; const sets = papers.map((p) => new Set(p));
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { let c = 0; for (const x of sets[i]) if (sets[j].has(x)) c++; worst = Math.max(worst, c); }
  assert.ok(worst <= 3, `worst overlap between two papers: ${worst}`);
});

test("SPREAD with topic balance off is perfect: every question used exactly once, then rotated evenly", () => {
  const exam = examOf({ questions: makePool(400), questionsPerStudent: 10, drawBalance: false });
  const { papers, usage } = enrol(exam, 120);
  assert.equal(new Set(papers.flat()).size, 1200); assert.ok(Object.values(usage).every((n) => n === 1));
  const small = examOf({ drawBalance: false }); const u = {};
  for (let s = 0; s < 40; s++) { const ids = pool.drawQuestionIds(small, { seed: R.newSeed(), usage: u }); for (const id of ids) u[id] = (u[id] || 0) + 1; const c = small.questions.map((q) => u[q._id] || 0); assert.ok(Math.max(...c) - Math.min(...c) <= 1); }
});

test("SPREAD: the first 6 students of a 300-question pool (40 each) share nothing, and recycling stays even (use differs by at most 2)", () => {
  const exam = examOf(); // pool 300, N = 40
  const { papers } = enrol(exam, 6);
  assert.equal(new Set(papers.flat()).size, 240, "6 x 40 = 240 distinct questions");
  const usage = {};
  for (let s = 0; s < 40; s++) {
    const ids = pool.drawQuestionIds(exam, { seed: R.newSeed(), usage }); for (const id of ids) usage[id] = (usage[id] || 0) + 1;
    const counts = exam.questions.map((q) => usage[q._id] || 0);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 2, `after student ${s + 1}, use ranges ${Math.min(...counts)}-${Math.max(...counts)}`);
  }
});

test("SPREAD still balances topics and keeps the difficulty mix for every student", () => {
  const exam = examOf({ drawMixDifficulty: true });
  const usage = {};
  for (let s = 0; s < 30; s++) {
    const ids = pool.drawQuestionIds(exam, { seed: R.newSeed(), usage }); for (const id of ids) usage[id] = (usage[id] || 0) + 1;
    const topic = TOPICS.map((t) => ids.filter((id) => exam.questions.find((q) => q._id === id).topic === t).length);
    assert.ok(Math.max(...topic) - Math.min(...topic) <= 1, `topics ${topic}`);
    const by = { easy: 0, medium: 0, hard: 0 }; for (const id of ids) by[exam.questions.find((q) => q._id === id).difficulty]++;
    assert.deepEqual(by, { easy: 12, medium: 20, hard: 8 });
  }
});

test("with spreading switched off, draws are independent (overlap follows the maths)", () => {
  const exam = examOf({ drawSpread: false });
  const { papers } = enrol(exam, 2); // usage is ignored
  assert.ok(papers[0].length === 40);
  let total = 0; const trials = 1000;
  for (let i = 0; i < trials; i++) { const usage = {}; const a = pool.drawQuestionIds(exam, { seed: R.newSeed(), usage }); for (const id of a) usage[id] = 1; const b = new Set(pool.drawQuestionIds(exam, { seed: R.newSeed(), usage })); total += a.filter((x) => b.has(x)).length; }
  assert.ok(Math.abs(total / trials - pool.expectedOverlap(40, 300)) < 0.7);
});

test("the same seed repeats exactly; a different seed differs", () => {
  const exam = examOf();
  assert.deepEqual(pool.drawQuestionIds(exam, { seed: "abc" }), pool.drawQuestionIds(exam, { seed: "abc" }));
  assert.notDeepEqual(pool.drawQuestionIds(exam, { seed: "abc" }), pool.drawQuestionIds(exam, { seed: "abd" }));
});

test("exams that mix subjects give every student an even share of each subject", () => {
  const qs = [...makePool(40, "Physics"), ...makePool(40, "Chemistry").map((q, i) => ({ ...q, _id: hex(1000 + i) })), ...makePool(40, "Biology").map((q, i) => ({ ...q, _id: hex(2000 + i) }))];
  const exam = examOf({ questions: qs, questionsPerStudent: 30 });
  for (let i = 0; i < 100; i++) {
    const ids = pool.drawQuestionIds(exam, { seed: R.newSeed() });
    const by = {}; for (const id of ids) { const s = qs.find((q) => q._id === id).subject; by[s] = (by[s] || 0) + 1; }
    assert.deepEqual(Object.values(by).sort(), [10, 10, 10]);
  }
});

test("a mixed-difficulty draw gives every student the same easy/medium/hard mix", () => {
  const exam = examOf({ drawMixDifficulty: true, questionsPerStudent: 40 });
  for (let i = 0; i < 50; i++) {
    const ids = pool.drawQuestionIds(exam, { seed: R.newSeed() });
    const by = { easy: 0, medium: 0, hard: 0 }; for (const id of ids) by[exam.questions.find((q) => q._id === id).difficulty]++;
    assert.deepEqual(by, { easy: 12, medium: 20, hard: 8 });
  }
});

test("retakes prefer questions the student has not seen; reuse only what is unavoidable", () => {
  const exam = examOf({ questions: makePool(50), questionsPerStudent: 40 }); // pool 150
  const first = pool.drawQuestionIds(exam, { seed: "a" });
  const second = pool.drawQuestionIds(exam, { seed: "b", seenIds: first });
  assert.equal(second.filter((x) => first.includes(x)).length, 0, "110 unseen questions exist, so none should repeat");
  const third = pool.drawQuestionIds(exam, { seed: "c", seenIds: [...first, ...second] }); // only 70 unseen: all 70 would be fine, but N=40 so still none repeat
  assert.equal(third.filter((x) => [...first, ...second].includes(x)).length, 0);
  const tight = examOf({ questions: makePool(15), questionsPerStudent: 40 }); // pool 45
  const a = pool.drawQuestionIds(tight, { seed: "a" }), b = pool.drawQuestionIds(tight, { seed: "b", seenIds: a });
  assert.equal(b.length, 40); assert.equal(new Set(b).size, 40);
  assert.equal(b.filter((x) => a.includes(x)).length, 35, "only 5 unseen questions exist, so exactly 35 must be reused");
});

test("N bigger than the pool, or not set: everyone simply gets the whole exam", () => {
  assert.equal(pool.drawQuestionIds(examOf({ questions: makePool(10), questionsPerStudent: 500 }), { seed: "x" }), null);
  assert.equal(pool.drawQuestionIds(examOf({ questionsPerStudent: undefined }), { seed: "x" }), null);
  assert.deepEqual(pool.shape(examOf({ questionsPerStudent: undefined })), { questionCount: 300, totalMarks: 300, poolSize: 300, drawn: false });
  assert.equal(pool.shape(examOf()).questionCount, 40);
});

test("what a student is told before starting reflects THEIR paper, not the pool", () => {
  const s = pool.shape(examOf({ questions: makePool(100).map((q, i) => ({ ...q, marks: 2 })) }));
  assert.deepEqual([s.questionCount, s.totalMarks, s.poolSize, s.drawn], [40, 80, 300, true]);
});

test("scoring uses only the student's own questions: right answers to all of them is 100%, not 40 of 300", () => {
  const exam = examOf(); const ids = pool.drawQuestionIds(exam, { seed: "s" });
  const served = R.servedQuestions(exam, { questionIds: ids });
  assert.equal(served.length, 40); assert.deepEqual(served.map((q) => q._id), ids);
  const answers = Object.fromEntries(served.map((q) => [q._id, "B"]));
  const r = scoreAttempt(served, answers);
  assert.deepEqual([r.score, r.totalMarks, r.correct, r.unanswered, r.percentage], [40, 40, 40, 0, 100]);
  const wrong = scoreAttempt(exam.questions, answers); // what the OLD code would have done
  assert.equal(wrong.unanswered, 260);
});

test("attempts without a question list (older ones) still get the whole exam", () => {
  const exam = examOf({ questions: makePool(5) });
  assert.equal(R.servedQuestions(exam, { seed: "x" }).length, 15);
  assert.equal(R.servedQuestions(exam, { questionIds: [] }).length, 15);
});

// ---------- the real examController ----------
let attempts, examDoc;
const matches = (d, f) => Object.entries(f).every(([k, v]) => (v && typeof v === "object" && "$gt" in v) ? new Date(d[k]) > v.$gt : String(d[k]) === String(v));
const lean = (v) => ({ lean: async () => v, select() { return this; }, sort() { return this; }, limit() { return this; } });
const FakeExam = { findById: (id) => lean(examDoc && String(examDoc._id) === String(id) ? JSON.parse(JSON.stringify(examDoc)) : null), find: () => lean([examDoc ? JSON.parse(JSON.stringify(examDoc)) : null].filter(Boolean)) };
const FakeAttempt = {
  findOne: (f) => lean(attempts.find((a) => matches(a, { examId: f.examId, userId: f.userId, status: f.status })) || null),
  findById: (id) => lean(attempts.find((a) => String(a._id) === String(id)) || null),
  countDocuments: async (f) => attempts.filter((a) => a.examId === String(f.examId) && a.userId === f.userId && a.status === f.status).length,
  find: (f) => lean(attempts.filter((a) => (!f.examId || a.examId === String(f.examId)) && (!f.userId || a.userId === f.userId) && (!f.status || a.status === f.status))),
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
  if (parent && /(controllers|utils)[\\/](examController|pool)\.js$/.test(parent.filename)) {
    if (req === "mongoose") return { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) };
    if (req === "../models/Exam") return FakeExam;
    if (req === "../models/Attempt") return FakeAttempt;
  }
  return orig.call(this, req, parent, ...rest);
};
const ctl = require("../controllers/examController");
const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ params: {}, body: {}, query: {}, ...req }, r); return r; };
const fresh = (over = {}) => { attempts = []; examDoc = examOf(over); };
const start = (u) => call(ctl.startAttempt, { params: { id: examDoc._id }, user: { id: u } });

test("controller: a pool exam gives a student exactly N questions, saved on the attempt, with no answer keys", async () => {
  fresh();
  const r = await start("u1");
  assert.equal(r.statusCode, 201); assert.equal(r.body.questions.length, 40);
  assert.equal(attempts[0].questionIds.length, 40);
  assert.deepEqual(r.body.questions.map((q) => q.id).sort(), [...attempts[0].questionIds].sort());
  assert.ok(!JSON.stringify(r.body).includes("correctKey"));
});

test("controller: refresh, resume and reopening show the same questions", async () => {
  fresh({ shuffleQuestions: true, shuffleOptions: true });
  const a = await start("u1"), b = await start("u1"), c = await call(ctl.getAttempt, { params: { id: attempts[0]._id }, user: { id: "u1" } });
  const sig = (r) => JSON.stringify(r.body.questions.map((q) => [q.id, q.options.map((o) => o.key)]));
  assert.equal(sig(a), sig(b)); assert.equal(sig(a), sig(c)); assert.equal(attempts.length, 1);
});

test("controller: different students receive different questions", async () => {
  fresh();
  const sets = []; for (let i = 0; i < 10; i++) sets.push((await start(`s${i}`)).body.questions.map((q) => q.id));
  assert.equal(new Set(sets.map((s) => s.join())).size, 10);
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.equal(sets[i].filter((id) => sets[j].includes(id)).length, 0, `students ${i} and ${j} share questions`);
});

test("controller: the score and result are out of the student's own N, and the review shows only those", async () => {
  fresh();
  const s = await start("u1"); const id = attempts[0]._id;
  for (let i = 0; i < 40; i++) await call(ctl.saveAnswer, { params: { id }, user: { id: "u1" }, body: { questionId: s.body.questions[i].id, choice: i < 30 ? "B" : "A" } });
  const sub = await call(ctl.submitAttempt, { params: { id }, user: { id: "u1" } });
  assert.deepEqual([sub.body.result.score, sub.body.result.totalMarks, sub.body.result.correct, sub.body.result.incorrect, sub.body.result.unanswered, sub.body.result.questionCount], [30, 40, 30, 10, 0, 40]);
  assert.equal(sub.body.result.percentage, 75);
  const rev = await call(ctl.result, { params: { id }, user: { id: "u1" } });
  assert.equal(rev.body.review.length, 40);
  assert.deepEqual(rev.body.review.map((q) => q.id), s.body.questions.map((q) => q.id));
});

test("controller: a student cannot answer a question that was not in their draw", async () => {
  fresh();
  const s = await start("u1"); const id = attempts[0]._id;
  const outside = examDoc.questions.find((q) => !s.body.questions.some((x) => x.id === q._id));
  const r = await call(ctl.saveAnswer, { params: { id }, user: { id: "u1" }, body: { questionId: outside._id, choice: "B" } });
  assert.equal(r.statusCode, 400);
});

test("controller: the exam list and intro tell the student 40 questions and 40 marks, not 300", async () => {
  fresh();
  const list = await call(ctl.listExams || ctl.list, { user: { id: "u1" } });
  const item = (list.body.exams || [])[0];
  assert.ok(item, "an exam is listed"); assert.equal(item.questionCount, 40); assert.equal(item.totalMarks, 40);
});

test("controller: a retake draws questions the student has not seen", async () => {
  fresh({ questions: makePool(50), maxAttempts: 3 });
  const s1 = await start("u1"); const id1 = attempts[0]._id;
  await call(ctl.submitAttempt, { params: { id: id1 }, user: { id: "u1" } });
  const s2 = await start("u1");
  const first = s1.body.questions.map((q) => q.id), second = s2.body.questions.map((q) => q.id);
  assert.equal(attempts.length, 2); assert.equal(second.filter((x) => first.includes(x)).length, 0);
});

test("controller: an exam with no per-student number behaves exactly as before", async () => {
  fresh({ questionsPerStudent: undefined, questions: makePool(5) });
  const r = await start("u1");
  assert.equal(r.body.questions.length, 15); assert.equal(attempts[0].questionIds, undefined);
});
