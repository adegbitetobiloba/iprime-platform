// Runs the real messaging controllers against in-memory stand-ins (no database, no network), like approvalFlow.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

let db, seq, audits, clock;
const same = (a, b) => String(a) === String(b);
const get = (d, k) => d[k];
const match = (d, q) => Object.entries(q).every(([k, v]) => {
  if (k === "$or") return v.some((alt) => match(d, alt));
  const val = get(d, k);
  if (v instanceof RegExp) return v.test(String(val || ""));
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("$in" in v) return v.$in.map(String).includes(String(val));
    if ("$gt" in v) return val > v.$gt;
    if ("$lt" in v) return String(val) < String(v.$lt);
    if ("$ne" in v) return val !== v.$ne;
  }
  return same(val, v);
});
const clone = (d) => (d ? { ...d } : d);
const query = (rows) => ({
  _rows: rows, select() { return this; }, lean() { return this; },
  sort(o) { const [k, dir] = Object.entries(o)[0]; const key = (v) => (v instanceof Date ? v.getTime() : String(v)); this._rows = [...this._rows].sort((a, b) => (key(a[k]) < key(b[k]) ? -dir : key(a[k]) > key(b[k]) ? dir : 0)); return this; },
  skip(n) { this._rows = this._rows.slice(n); return this; }, limit(n) { this._rows = this._rows.slice(0, n); return this; },
  then(res, rej) { return Promise.resolve(this._rows.map(clone)).then(res, rej); },
});
const one = (rows) => ({ select() { return this; }, lean() { return this; }, then(res, rej) { return Promise.resolve(clone(rows[0]) || null).then(res, rej); } });
const id = (p) => `${p}${String(++seq).padStart(6, "0")}`;
const applyUpdate = (d, upd) => {
  for (const [k, v] of Object.entries(upd.$set || {})) d[k] = v;
  for (const [k, v] of Object.entries(upd.$inc || {})) d[k] = (d[k] || 0) + v;
};

const Conversation = {
  findOne: (q) => one(db.conversations.filter((d) => match(d, q))),
  find: (q) => query(db.conversations.filter((d) => match(d, q))),
  countDocuments: async (q) => db.conversations.filter((d) => match(d, q)).length,
  findOneAndUpdate: (q, upd) => {
    let d = db.conversations.find((x) => match(x, q));
    if (!d) { d = { _id: id("c"), ...(upd.$setOnInsert || {}) }; db.conversations.push(d); }
    applyUpdate(d, upd);
    return one([d]);
  },
  updateOne: async (q, upd) => { const d = db.conversations.find((x) => match(x, q)); if (d) applyUpdate(d, upd); },
};
const Message = {
  create: async (f) => { const m = { _id: id("m"), createdAt: new Date(++clock), ...f }; db.messages.push(m); return { ...m, toObject: () => ({ ...m }) }; },
  find: (q) => query(db.messages.filter((d) => match(d, q))),
};
const User = {
  findOne: (q) => one(db.users.filter((d) => match(d, q))),
  findById: (i) => one(db.users.filter((d) => same(d._id, i))),
  find: (q) => query(db.users.filter((d) => match(d, q))),
};
const Attempt = { findOne: (q) => one(db.attempts.filter((d) => match(d, q))), find: (q) => query(db.attempts.filter((d) => match(d, q))) };
const Exam = { findById: (i) => one(db.exams.filter((d) => same(d._id, i))), find: (q) => query(db.exams.filter((d) => match(d, q))) };
const paging = { parsePaging: (q) => ({ page: 1, limit: 20, skip: 0 }), escapeRegExp: (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") };

const stubs = {
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  "../models/Conversation": Conversation, "../models/Message": Message, "../models/User": User, "../models/Attempt": Attempt, "../models/Exam": Exam,
  "../utils/paging": paging, "../utils/audit": { audit: async (req, e) => { audits.push(e); } },
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /(messageController|adminMessageController)\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};
const student = require("../controllers/messageController");
const admin = require("../controllers/adminMessageController");

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn(req, r); return r; };
const as = (uid, role = "student") => ({ id: uid, role });
const staff = as("a1", "admin");

beforeEach(() => {
  seq = 0; clock = 1000; audits = [];
  db = {
    conversations: [], messages: [], exams: [{ _id: "x1", title: "Mock 1", subject: "Mathematics" }],
    users: [
      { _id: "s1", role: "student", firstName: "Ada", lastName: "Obi", studentId: "PET-AAA" },
      { _id: "s2", role: "student", firstName: "Bayo", lastName: "Eze", studentId: "PET-BBB" },
      { _id: "t1", role: "teacher", firstName: "Tola", lastName: "T" },
      { _id: "a1", role: "admin", firstName: "Chidi", lastName: "Admin" },
    ],
    attempts: [
      { _id: "t-ok", userId: "s1", examId: "x1", status: "submitted", score: 14, totalMarks: 20, percentage: 70, submittedAt: new Date("2026-10-30") },
      { _id: "t-other", userId: "s2", examId: "x1", status: "submitted", score: 5, totalMarks: 20, percentage: 25, submittedAt: new Date("2026-10-30") },
      { _id: "t-open", userId: "s1", examId: "x1", status: "in_progress" },
    ],
  };
});

const send = (uid, text, extra = {}) => call(student.send, { user: as(uid), body: { body: text, ...extra } });
const asend = (sid, text, extra = {}) => call(admin.send, { user: staff, params: { studentId: sid }, body: { body: text, ...extra } });

// ---------- student side ----------
test("a student's message goes to their own thread and shows the team as unread", async () => {
  const r = await send("s1", "Hello, I need help with Mathematics");
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.message.from, "student");
  assert.equal(db.conversations.length, 1);
  assert.equal(String(db.conversations[0].studentId), "s1");
  assert.equal(db.conversations[0].adminUnread, 1);
  assert.equal(db.conversations[0].lastSenderRole, "student");
});
test("a student cannot choose a recipient: extra fields are ignored and no other thread is touched", async () => {
  await send("s2", "first");
  await send("s1", "sneaky", { studentId: "s2", to: "s2", conversationId: db.conversations[0]._id });
  assert.equal(db.conversations.length, 2);
  const s2 = db.conversations.find((c) => c.studentId === "s2");
  assert.equal(s2.adminUnread, 1);                                 // untouched by s1
  assert.equal(db.messages.filter((m) => m.conversationId === s2._id).length, 1);
});
test("students only ever read their own thread", async () => {
  await send("s1", "from ada"); await send("s2", "from bayo");
  const r = await call(student.thread, { user: as("s1"), query: {} });
  assert.deepEqual(r.body.messages.map((m) => m.body), ["from ada"]);
});
test("a student sees the team as 'team': no administrator name or id", async () => {
  await asend("s1", "Well done on Mock 1");
  const r = await call(student.thread, { user: as("s1"), query: {} });
  const m = r.body.messages[0];
  assert.equal(m.from, "admin");
  assert.equal(m.senderName, undefined); assert.equal(m.senderId, undefined);
});
test("a student with no thread gets an empty list, not an error", async () => {
  const r = await call(student.thread, { user: as("s1"), query: {} });
  assert.deepEqual(r.body, { unread: 0, messages: [], hasMore: false });
});
test("unread: the team's message raises it, opening the thread clears it", async () => {
  await asend("s1", "Please see me on Monday");
  assert.equal((await call(student.unread, { user: as("s1") })).body.unread, 1);
  assert.equal((await call(student.thread, { user: as("s1"), query: {} })).body.unread, 1);
  await call(student.markRead, { user: as("s1") });
  assert.equal((await call(student.unread, { user: as("s1") })).body.unread, 0);
});
test("the thread is paged: 50 at a time, oldest first, with a cursor for older ones", async () => {
  for (let i = 1; i <= 55; i++) await send("s1", `m${i}`);
  const first = await call(student.thread, { user: as("s1"), query: {} });
  assert.equal(first.body.messages.length, 50);
  assert.equal(first.body.hasMore, true);
  assert.equal(first.body.messages[0].body, "m6");
  assert.equal(first.body.messages.at(-1).body, "m55");
  const older = await call(student.thread, { user: as("s1"), query: { before: first.body.messages[0].id } });
  assert.deepEqual(older.body.messages.map((m) => m.body), ["m1", "m2", "m3", "m4", "m5"]);
  assert.equal(older.body.hasMore, false);
});

// ---------- admin side ----------
test("an administrator can message a student; the student's unread count goes up", async () => {
  const r = await asend("s1", "Welcome to Prime");
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.message.senderName, "Chidi");
  assert.equal(db.conversations[0].studentUnread, 1);
  assert.equal(db.conversations[0].adminUnread, 0);
});
test("only real students can be messaged: teachers, admins and unknown ids are 'not found'", async () => {
  for (const sid of ["t1", "a1", "nobody"]) assert.equal((await asend(sid, "hi")).statusCode, 404);
  assert.equal(db.messages.length, 0);
});
test("a performance comment is built from the stored attempt, not from anything the client sends", async () => {
  const r = await asend("s1", "Good effort. Revise algebra.", { attemptId: "t-ok", score: 999, percentage: 100, examTitle: "Fake exam" });
  assert.equal(r.statusCode, 201);
  const c = r.body.message.context;
  assert.equal(c.kind, "attempt");
  assert.equal(c.examTitle, "Mock 1"); assert.equal(c.score, 14); assert.equal(c.totalMarks, 20); assert.equal(c.percentage, 70);
  const seen = await call(student.thread, { user: as("s1"), query: {} });
  assert.equal(seen.body.messages[0].context.percentage, 70);
});
test("a comment cannot be attached to another student's result or to an unfinished attempt", async () => {
  assert.equal((await asend("s1", "x", { attemptId: "t-other" })).statusCode, 404);
  assert.equal((await asend("s1", "x", { attemptId: "t-open" })).statusCode, 404);
  assert.equal(db.messages.length, 0);
});
test("sending is audited, and the audit entry never contains the message text", async () => {
  await asend("s1", "private words about marks", { attemptId: "t-ok" });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].event, "message.admin_sent");
  assert.equal(audits[0].meta.hasResultComment, true);
  assert.ok(!JSON.stringify(audits[0]).includes("private words"));
});
test("the admin inbox lists conversations, newest first, with names and unread counts, and can filter to unread", async () => {
  await send("s1", "older"); await send("s2", "newer");
  await call(admin.markRead, { user: staff, params: { studentId: "s1" } });
  const all = await call(admin.conversations, { user: staff, query: {} });
  assert.deepEqual(all.body.conversations.map((c) => c.student.name), ["Bayo Eze", "Ada Obi"]);
  assert.equal(all.body.conversations[0].unread, 1);
  const unread = await call(admin.conversations, { user: staff, query: { unread: "1" } });
  assert.deepEqual(unread.body.conversations.map((c) => c.student.name), ["Bayo Eze"]);
  assert.equal((await call(admin.summary, { user: staff })).body.unreadConversations, 1);
});
test("an administrator sees who on the team wrote each message; opening the thread clears their unread", async () => {
  await send("s1", "question"); await asend("s1", "answer");
  const t = await call(admin.thread, { user: staff, params: { studentId: "s1" }, query: {} });
  assert.deepEqual(t.body.messages.map((m) => [m.from, m.senderName]), [["student", undefined], ["admin", "Chidi"]]);
  assert.equal(t.body.student.studentId, "PET-AAA");
  await call(admin.markRead, { user: staff, params: { studentId: "s1" } });
  assert.equal(db.conversations[0].adminUnread, 0);
});
test("the result picker lists only that student's submitted attempts", async () => {
  const r = await call(admin.attempts, { user: staff, params: { studentId: "s1" } });
  assert.deepEqual(r.body.attempts.map((a) => a.id), ["t-ok"]);
  assert.equal(r.body.attempts[0].examTitle, "Mock 1");
});
test("student search needs 2+ characters, finds students only, and treats special characters as plain text", async () => {
  assert.deepEqual((await call(admin.searchStudents, { user: staff, query: { search: "a" } })).body.students, []);
  const ada = await call(admin.searchStudents, { user: staff, query: { search: "ada" } });
  assert.deepEqual(ada.body.students.map((s) => s.name), ["Ada Obi"]);
  assert.deepEqual((await call(admin.searchStudents, { user: staff, query: { search: "tola" } })).body.students, []);  // a teacher
  assert.deepEqual((await call(admin.searchStudents, { user: staff, query: { search: ".*" } })).body.students, []);    // not a wildcard
});

test("two first messages at the same instant do not fail: the loser reads the thread the winner created", async () => {
  const real = Conversation.findOneAndUpdate;
  let thrown = false;
  Conversation.findOneAndUpdate = (q, upd) => {
    if (!thrown) { thrown = true; db.conversations.push({ _id: id("c"), studentId: "s1", studentUnread: 0, adminUnread: 0 }); const e = new Error("E11000"); e.code = 11000; return { lean() { return this; }, then: (res, rej) => Promise.reject(e).then(res, rej) }; }
    return real(q, upd);
  };
  try {
    const r = await send("s1", "first message");
    assert.equal(r.statusCode, 201);
    assert.equal(db.conversations.length, 1);
    assert.equal(db.conversations[0].adminUnread, 1);
  } finally { Conversation.findOneAndUpdate = real; }
});
test("a student's message text is stored as plain text and returned unchanged (the page escapes it)", async () => {
  const r = await send("s1", "<script>alert(1)</script> 5 > 3");
  assert.equal(r.body.message.body, "<script>alert(1)</script> 5 > 3");
});
