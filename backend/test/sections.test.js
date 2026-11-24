// Per-subject quotas (JAMB structure), per-subject result breakdown, subject blocks, and the top-10 leaderboard.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../utils/pool");
const R = require("../utils/randomise");
const { breakdownBySubject } = require("../utils/results");
const { makeExamExtrasService, displayName } = require("../utils/examExtrasService");
const { rankFirstAttempts } = require("./helpers/rankFirst");
const { hex, collection, call } = require("./helpers/shareFakes");

const SUBJECTS = { English: 120, Maths: 100, Physics: 110, Chemistry: 100 };
let uid = 0;
const mkQs = () => Object.entries(SUBJECTS).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => ({ _id: hex(++uid), text: `${s} ${i}`, subject: s, topic: `T${i % 5}`, marks: 1, correctKey: "B", options: ["A", "B", "C", "D"].map((k) => ({ key: k, text: k })) })));
const QUOTA = [{ subject: "English", count: 60 }, { subject: "Maths", count: 40 }, { subject: "Physics", count: 40 }, { subject: "Chemistry", count: 40 }];
const exam = (over = {}) => ({ _id: hex(900), subject: "UTME", status: "published", maxAttempts: 1, questions: mkQs(), sections: QUOTA, ...over });
const countBy = (ex, ids) => { const by = {}; for (const id of ids) { const s = ex.questions.find((q) => q._id === id).subject; by[s] = (by[s] || 0) + 1; } return by; };

test("every student gets EXACTLY the quota for each subject: 60 English, 40 Maths, 40 Physics, 40 Chemistry", () => {
  const ex = exam();
  for (let i = 0; i < 200; i++) {
    const ids = pool.drawQuestionIds(ex, { seed: R.newSeed() });
    assert.equal(ids.length, 180); assert.equal(new Set(ids).size, 180);
    assert.deepEqual(countBy(ex, ids), { English: 60, Maths: 40, Physics: 40, Chemistry: 40 });
  }
  assert.deepEqual(pool.shape(ex), { questionCount: 180, totalMarks: 180, poolSize: 430, drawn: true });
});

test("papers are grouped by subject in the examiner's order (English first), like a JAMB paper", () => {
  const ex = exam(); const ids = pool.drawQuestionIds(ex, { seed: "s" });
  const order = ids.map((id) => ex.questions.find((q) => q._id === id).subject);
  assert.deepEqual(order.filter((s, i) => i === 0 || s !== order[i - 1]), ["English", "Maths", "Physics", "Chemistry"]);
});

test("different students get different questions within each subject", () => {
  const ex = exam(); const sets = new Set();
  for (let i = 0; i < 20; i++) sets.add(pool.drawQuestionIds(ex, { seed: R.newSeed() }).join());
  assert.equal(sets.size, 20);
});

test("there is no 500 cap: quotas can be as large as the pool", () => {
  const big = Array.from({ length: 1500 }, (_, i) => ({ _id: hex(++uid + 50000), subject: "English", topic: "T", marks: 1 }));
  const ex = { _id: hex(901), questions: big, sections: [{ subject: "English", count: 1200 }] };
  assert.equal(pool.drawQuestionIds(ex, { seed: "x" }).length, 1200);
  assert.equal(pool.perStudent({ questionsPerStudent: 5000 }), 5000);
});

test("a subject with fewer questions than its quota gives all it has; a subject missing from the pool gives none, and nothing is invented", () => {
  const ex = exam({ sections: [{ subject: "English", count: 500 }, { subject: "Biology", count: 40 }, { subject: "Maths", count: 10 }] });
  assert.deepEqual(countBy(ex, pool.drawQuestionIds(ex, { seed: "s" })), { English: 120, Maths: 10 });
  assert.equal(pool.shape(ex).questionCount, 130);
});

test("subject matching ignores letter case; junk quotas are ignored; no sections means the old behaviour", () => {
  const ex = exam({ sections: [{ subject: "english", count: 5 }, { subject: "", count: 9 }, { subject: "Maths", count: 0 }, { subject: "Physics", count: "x" }] });
  assert.deepEqual(countBy(ex, pool.drawQuestionIds(ex, { seed: "s" })), { English: 5 });
  assert.equal(pool.drawQuestionIds(exam({ sections: undefined, questionsPerStudent: 50 }), { seed: "s" }).length, 50);
  assert.equal(pool.drawQuestionIds(exam({ sections: [] }), { seed: "s" }), null);
});

test("shuffling a multi-subject paper keeps each subject together and shuffles within it; the student view names the subject", () => {
  const ex = exam(); const ids = pool.drawQuestionIds(ex, { seed: "s" });
  const att = { seed: "abc", shuffleQuestions: true, shuffleOptions: true, questionIds: ids };
  const arr = R.arrange(ex.questions, att);
  const subs = arr.map((e) => e.q.subject);
  assert.deepEqual(subs.filter((s, i) => i === 0 || s !== subs[i - 1]), ["English", "Maths", "Physics", "Chemistry"]);
  assert.deepEqual(R.arrange(ex.questions, att).map((e) => e.q._id), arr.map((e) => e.q._id), "same seed, same paper");
  assert.notDeepEqual(R.arrange(ex.questions, { ...att, seed: "zzz" }).map((e) => e.q._id), arr.map((e) => e.q._id));
  assert.equal(R.studentView(arr[0]).subject, "English"); assert.equal(R.reviewView(arr[0], {}).subject, "English");
});

test("breakdown: English 38/60, Physics 22/40, Chemistry 28/40, Maths 22/40 gives 110/180 = 61.11% with the subject percentages", () => {
  const ex = exam(); const served = R.servedQuestions(ex, { questionIds: pool.drawQuestionIds(ex, { seed: "s" }) });
  const want = { English: 38, Physics: 22, Chemistry: 28, Maths: 22 }, seen = {}, answers = {};
  for (const q of served) { seen[q.subject] = (seen[q.subject] || 0) + 1; answers[q._id] = seen[q.subject] <= want[q.subject] ? "B" : "A"; }
  const b = breakdownBySubject(served, answers, "UTME"); const row = (s) => b.subjects.find((x) => x.subject === s);
  assert.deepEqual([row("English").score, row("English").total, row("English").percentage], [38, 60, 63.33]);
  assert.deepEqual([row("Physics").score, row("Physics").total, row("Physics").percentage], [22, 40, 55]);
  assert.deepEqual([row("Chemistry").score, row("Chemistry").total, row("Chemistry").percentage], [28, 40, 70]);
  assert.deepEqual([row("Maths").score, row("Maths").total, row("Maths").percentage], [22, 40, 55]);
  assert.deepEqual(b.overall, { questions: 180, total: 180, score: 110, percentage: 61.11 });
  assert.deepEqual(b.subjects.map((s) => s.subject), ["English", "Maths", "Physics", "Chemistry"]);
});

test("breakdown: counts right, wrong and blank, honours marks, falls back to the exam's subject, and never divides by zero", () => {
  const qs = [{ _id: "1", marks: 2, correctKey: "A" }, { _id: "2", marks: 2, correctKey: "A" }, { _id: "3", marks: 1, correctKey: "A", subject: "Maths" }];
  const b = breakdownBySubject(qs, { 1: "A", 2: "B" }, "Physics");
  assert.deepEqual(b.subjects.map((s) => [s.subject, s.correct, s.incorrect, s.unanswered, s.score, s.total, s.percentage]), [["Physics", 1, 1, 0, 2, 4, 50], ["Maths", 0, 0, 1, 0, 1, 0]]);
  assert.deepEqual(breakdownBySubject([], {}, "x"), { subjects: [], overall: { questions: 0, total: 0, score: 0, percentage: 0 } });
  assert.equal(breakdownBySubject([{ _id: "9", marks: 1, correctKey: "A" }], {}).subjects[0].subject, "General");
});

let db, svc;
const examId = hex(900);
function setup({ lb = { enabled: true, names: "short" }, examOver = {} } = {}) {
  db = { exams: [{ _id: examId, status: "published", subject: "UTME", questions: [{ _id: "q1", marks: 1, correctKey: "B", subject: "English" }, { _id: "q2", marks: 1, correctKey: "B", subject: "Maths" }], ...examOver }], access: lb ? [{ _id: hex(50), examId, leaderboard: lb }] : [], attempts: [], shares: [{ _id: hex(300), examId, token: "T".repeat(32), uses: 0 }] };
  const users = new Map();
  const people = { async list(ids) { return ids.map((i) => users.get(String(i))).filter(Boolean); } };
  svc = makeExamExtrasService({ Attempt: collection(db.attempts), Exam: collection(db.exams), ExamAccess: collection(db.access), ExamShare: collection(db.shares), people, rankFirstAttempts });
  return users;
}
const when = (m) => new Date(Date.UTC(2026, 10, 7, 10, m));
const submit = (users, n, name, pct, extra = {}) => { const id = hex(100 + n); users.set(id, { _id: id, firstName: name[0], lastName: name[1] || "", ...(extra.guest ? { guest: true, lastName: "(guest)" } : {}) }); db.attempts.push({ _id: hex(2000 + db.attempts.length), examId, userId: id, status: "submitted", percentage: pct, score: pct, totalMarks: 100, startedAt: when(0), submittedAt: when(extra.mins ?? 30 + n) }); return id; };
const student = (id = hex(7)) => ({ id, role: "student" });

test("leaderboard: switched off by the examiner means nothing is shown", async () => {
  const u = setup({ lb: null }); submit(u, 1, ["Ada", "Obi"], 80);
  assert.deepEqual((await call(svc.leaderboard, { params: { id: examId }, user: student() })).body, { enabled: false });
  setup({ lb: { enabled: false, names: "full" } });
  assert.equal((await call(svc.leaderboardByLink, { params: { token: "T".repeat(32) } })).body.enabled, false);
});

test("leaderboard: the top 10 with shared ranks, same rules as analytics (first attempt counts, ties share a rank)", async () => {
  const u = setup();
  [90, 85, 85, 70, 65, 60, 55, 50, 45, 40, 35, 30].forEach((p, i) => submit(u, i + 1, [`Student${"abcdefghijkl"[i]}`, "Obi"], p));
  db.attempts.push({ _id: hex(3000), examId, userId: hex(101), status: "submitted", percentage: 100, score: 100, totalMarks: 100, startedAt: when(100), submittedAt: when(140) });
  const r = await call(svc.leaderboard, { params: { id: examId }, user: student() });
  assert.equal(r.body.participants, 12);
  assert.deepEqual(r.body.entries.map((e) => e.rank), [1, 2, 2, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.body.entries[0].percentage, 90, "a better retake does not move the person up");
});

test("leaderboard: names follow the examiner's choice and guests appear by the name they typed", async () => {
  for (const [style, expected] of [["full", "Ada Obi"], ["short", "Ada O."], ["none", "Student"]]) {
    const u = setup({ lb: { enabled: true, names: style } }); submit(u, 1, ["Ada", "Obi"], 80);
    assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: student() })).body.entries[0].name, expected, style);
  }
  const u = setup({ lb: { enabled: true, names: "full" } }); submit(u, 1, ["Tunde Bello"], 70, { guest: true });
  assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: student() })).body.entries[0].name, "Tunde Bello");
  assert.equal(displayName({ firstName: "Chukwuemeka O'Brien", lastName: "(guest)", guest: true }, "short"), "Chukwuemeka O.");
  assert.equal(displayName(null, "full"), "Student");
});

test("leaderboard: a person sees where they stand, even outside the top 10; someone who has not sat it can still look", async () => {
  const u = setup();
  for (let i = 1; i <= 14; i++) submit(u, i, [`Person${"abcdefghijklmn"[i - 1]}`, "X"], 100 - i * 5);
  const r = await call(svc.leaderboard, { params: { id: examId }, user: student(hex(114)) });
  assert.deepEqual(r.body.you, { rank: 14, percentage: 30, outOf: 14 }); assert.equal(r.body.entries.some((e) => e.you), false);
  assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: student(hex(101)) })).body.entries[0].you, true);
  const nobody = await call(svc.leaderboard, { params: { id: examId }, user: student(hex(999)) });
  assert.equal(nobody.body.you, null); assert.equal(nobody.body.entries.length, 10);
});

test("leaderboard: by link works for a live link only, and never exposes account ids", async () => {
  const u = setup(); submit(u, 1, ["Ada", "Obi"], 80);
  const ok = await call(svc.leaderboardByLink, { params: { token: "T".repeat(32) } });
  assert.equal(ok.body.entries[0].name, "Ada O."); assert.equal(ok.body.entries[0].you, false);
  assert.ok(!JSON.stringify(ok.body).includes(hex(101)), "no account ids are ever sent");
  assert.equal((await call(svc.leaderboardByLink, { params: { token: "nope" } })).statusCode, 404);
  assert.equal((await call(svc.leaderboardByLink, { params: { token: "U".repeat(32) } })).statusCode, 404);
  db.shares[0].revokedAt = new Date();
  assert.equal((await call(svc.leaderboardByLink, { params: { token: "T".repeat(32) } })).statusCode, 404);
});

test("leaderboard: only for published exams, and a guest only for their own exam", async () => {
  setup({ examOver: { status: "draft" } });
  assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: student() })).statusCode, 404);
  setup();
  assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: { id: hex(60), role: "guest", guest: true, eid: hex(901) } })).statusCode, 404);
  assert.equal((await call(svc.leaderboard, { params: { id: examId }, user: { id: hex(60), role: "guest", guest: true, eid: examId } })).statusCode, 200);
  assert.equal((await call(svc.leaderboard, { params: { id: "bad" }, user: { id: hex(7) } })).statusCode, 404);
});

test("breakdown endpoint: owner and admin only; unfinished attempts say so; a pooled paper is marked against the student's own questions", async () => {
  setup(); const me = hex(7);
  db.attempts.push({ _id: hex(4000), examId, userId: me, status: "submitted", startedAt: when(0), submittedAt: when(90), answers: { q1: "B", q2: "A" } });
  db.attempts.push({ _id: hex(4001), examId, userId: me, status: "in_progress", startedAt: when(0), answers: {} });
  const ok = await call(svc.breakdown, { params: { id: hex(4000) }, user: student(me) });
  assert.deepEqual(ok.body.subjects.map((s) => [s.subject, s.score, s.total, s.percentage]), [["English", 1, 1, 100], ["Maths", 0, 1, 0]]);
  assert.deepEqual([ok.body.overall.score, ok.body.overall.percentage, ok.body.overall.timeUsedSeconds], [1, 50, 5400]);
  assert.equal((await call(svc.breakdown, { params: { id: hex(4000) }, user: student(hex(8)) })).statusCode, 404);
  assert.equal((await call(svc.breakdown, { params: { id: hex(4000) }, user: { id: hex(9), role: "admin" } })).statusCode, 200);
  assert.equal((await call(svc.breakdown, { params: { id: hex(4001) }, user: student(me) })).statusCode, 409);
  setup({ examOver: { questions: [{ _id: "q1", marks: 1, correctKey: "B", subject: "English" }, { _id: "q2", marks: 1, correctKey: "B", subject: "Maths" }, { _id: "q3", marks: 1, correctKey: "B", subject: "Maths" }] } });
  db.attempts.push({ _id: hex(4002), examId, userId: me, status: "submitted", startedAt: when(0), submittedAt: when(10), answers: { q1: "B", q3: "B" }, questionIds: ["q1", "q3"] });
  assert.equal((await call(svc.breakdown, { params: { id: hex(4002) }, user: student(me) })).body.overall.total, 2);
});
