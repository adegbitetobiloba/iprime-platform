const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { hex, collection, call } = require("./helpers/shareFakes");
const { makeAdminAccessService } = require("../utils/adminAccessService");

const examId = hex(900), admin = { id: hex(9), role: "admin" };
let db, svc, audits, dropSections;
beforeEach(() => {
  dropSections = false; audits = [];
  db = { exams: [{ _id: examId, title: "T", status: "draft", questions: [{ _id: "1", subject: "English" }, { _id: "2", subject: "English" }, { _id: "3", subject: "Maths" }, { _id: "4" }] }], access: [], shares: [], grants: [], guests: [], users: [], attempts: [] };
  const Exam = collection(db.exams); const realUpdate = Exam.updateOne;
  Exam.updateOne = async (f, u) => realUpdate(f, dropSections ? { $set: {} } : u);
  svc = makeAdminAccessService({ Exam, ExamAccess: collection(db.access), ExamShare: collection(db.shares), ShareGrant: collection(db.grants), Guest: collection(db.guests), User: collection(db.users), Attempt: collection(db.attempts), audit: async (r, e) => { audits.push(e); } });
});
const R = (fn, body, params = { id: examId }) => call(fn, { user: admin, params, body });

test("per-subject quotas are saved, the total each student gets is worked out, and the pool by subject is shown", async () => {
  assert.equal((await R(svc.putDraw, { sections: [{ subject: "English", count: 60 }, { subject: " Maths ", count: 40 }, { subject: "Physics", count: 40 }, { subject: "Chemistry", count: 40 }] })).statusCode, 200);
  assert.deepEqual(db.exams[0].sections.map((s) => [s.subject, s.count]), [["English", 60], ["Maths", 40], ["Physics", 40], ["Chemistry", 40]]);
  assert.equal(db.exams[0].questionsPerStudent, 180);
  const g = await R(svc.get, undefined);
  assert.deepEqual(g.body.draw.poolBySubject, [{ subject: "English", count: 2 }, { subject: "Maths", count: 1 }, { subject: "(no subject)", count: 1 }]);
});

test("quotas have no 500 limit, but bad input is refused", async () => {
  assert.equal((await R(svc.putDraw, { sections: [{ subject: "English", count: 1200 }] })).statusCode, 200);
  assert.equal(db.exams[0].questionsPerStudent, 1200);
  for (const bad of [[{ subject: "", count: 5 }], [{ subject: "A", count: 0 }], [{ subject: "A", count: 2.5 }], [{ subject: "A", count: 20001 }], [{ subject: "A", count: 1 }, { subject: "a", count: 2 }], "x"]) assert.equal((await R(svc.putDraw, { sections: bad })).statusCode, 400);
  assert.equal((await R(svc.putDraw, {})).statusCode, 400);
  assert.equal((await R(svc.putDraw, { questionsPerStudent: 30000 })).statusCode, 400);
  assert.equal((await R(svc.putDraw, { questionsPerStudent: 2500 })).statusCode, 200);
  assert.deepEqual(db.exams[0].sections, []);
});

test("locked once published or attempted; and a missing `sections` field in the Exam model is reported, not silently ignored", async () => {
  db.exams[0].status = "published";
  assert.equal((await R(svc.putDraw, { questionsPerStudent: 10 })).statusCode, 409);
  db.exams[0].status = "draft"; db.attempts.push({ _id: hex(5), examId, userId: hex(7) });
  assert.equal((await R(svc.putDraw, { sections: [{ subject: "English", count: 1 }] })).statusCode, 409);
  db.attempts.length = 0; dropSections = true;
  const r = await R(svc.putDraw, { sections: [{ subject: "English", count: 5 }] });
  assert.equal(r.statusCode, 500); assert.match(r.body.error, /sections/);
});

test("the scoreboard switch: on or off, and how names appear", async () => {
  assert.equal((await R(svc.putLeaderboard, { enabled: "yes" })).statusCode, 400);
  assert.equal((await R(svc.putLeaderboard, { enabled: true, names: "nickname" })).statusCode, 400);
  assert.deepEqual((await R(svc.putLeaderboard, { enabled: true, names: "full" })).body.leaderboard, { enabled: true, names: "full" });
  assert.deepEqual((await R(svc.get, undefined)).body.access.leaderboard, { enabled: true, names: "full" });
  assert.deepEqual((await R(svc.putLeaderboard, { enabled: false })).body.leaderboard, { enabled: false, names: "short" });
});
