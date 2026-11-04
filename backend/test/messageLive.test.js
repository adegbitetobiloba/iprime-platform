// Live delivery, email alerts, blocking, assigning, searching and attachments, using the real controllers
// against in-memory stand-ins.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const F = require("./helpers/fakes");

let db, audits, mail;
const M = (name, opts) => new Proxy({}, { get: (_, k) => F.model(db[name], opts)[k] });
F.install({
  mongoose: { isValidObjectId: (v) => typeof v === "string" && v.length > 0 },
  "../models/Conversation": M("convs", { prefix: "c", unique: [["studentId"]] }), "../models/Message": M("messages", { prefix: "m" }),
  "../models/MessageFile": M("files", { prefix: "f", defaults: { attached: false } }), "../models/User": M("users", { prefix: "u" }),
  "../models/Attempt": M("attempts", { prefix: "t" }), "../models/Exam": M("exams", { prefix: "x" }),
  "../utils/paging": F.paging, "../utils/audit": { audit: async (req, e) => { audits.push(e); } },
  "../utils/messageNotify": { notifyStudentNewMessage: async (s) => { mail.push(["student", s.email]); }, notifyAdminsNewMessage: async (n) => { mail.push(["admins", n]); } },
}, /(messageController|adminMessageController|messageFileController)\.js$/);
const hub = require("../utils/messageHub");
const student = require("../controllers/messageController");
const admin = require("../controllers/adminMessageController");
const files = require("../controllers/messageFileController");
const { call } = F;

const S = (id) => ({ id, role: "student" });
const A = { id: "a1", role: "admin" };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const listener = (key) => { const got = []; hub.subscribe(key, { write: (x) => got.push(JSON.parse(x.replace(/^data: /, "").trim())), end() {} }); return got; };

beforeEach(() => {
  F.resetIds(); audits = []; mail = [];
  db = { convs: [], messages: [], files: [], attempts: [], exams: [], users: [
    { _id: "s1", role: "student", firstName: "Ada", lastName: "Obi", studentId: "PET-ADA1", email: "ada@x.com", isVerified: true },
    { _id: "s2", role: "student", firstName: "Bayo", lastName: "Eze", studentId: "PET-BAY2", email: "bayo@x.com", isVerified: true },
    { _id: "a1", role: "admin", firstName: "Chidi", lastName: "Admin", email: "chidi@x.com" },
    { _id: "a2", role: "admin", firstName: "Dayo", lastName: "Boss", email: "dayo@x.com" },
    { _id: "t1", role: "teacher", firstName: "Tola", lastName: "T" },
  ] };
});
const send = (uid, body, extra = {}) => call(student.send, { user: S(uid), body: { body, ...extra } });
const asend = (sid, body, extra = {}) => call(admin.send, { user: A, params: { studentId: sid }, body: { body, ...extra } });
const upload = (uid, buf = PNG, type = "image/png", name = "photo.png") => call(files.uploadStudent, { user: S(uid), body: buf, headers: { "content-type": type, "x-file-name": name } });
const aupload = (sid, buf = PNG, type = "image/png") => call(files.uploadAdmin, { user: A, params: { studentId: sid }, body: buf, headers: { "content-type": type } });

// ---------- instant delivery ----------
test("a student's message is pushed live to administrators and to the student's own other tabs, and to nobody else", async () => {
  const admins = listener("admins"), mine = listener("student:s1"), other = listener("student:s2");
  await send("s1", "Hello team");
  assert.equal(admins.length, 1); assert.equal(admins[0].type, "message"); assert.equal(admins[0].studentId, "s1"); assert.equal(admins[0].message.body, "Hello team");
  assert.equal(mine.length, 1); assert.equal(mine[0].message.from, "student");
  assert.equal(other.length, 0);
});
test("an administrator's message is pushed live to that student only, and the student's copy hides the administrator's name", async () => {
  const s1 = listener("student:s1"), s2 = listener("student:s2"), admins = listener("admins");
  await asend("s1", "Welcome");
  assert.equal(s1.length, 1); assert.equal(s1[0].message.body, "Welcome"); assert.equal(s1[0].message.senderName, undefined);
  assert.equal(s2.length, 0);
  assert.equal(admins.at(-1).message.senderName, "Chidi");
});
test("opening a stream registers the connection under the right key for each role", async () => {
  const mk = (user) => ({ req: Object.assign(new EventEmitter(), { user }), res: { status() { return this; }, set() {}, flushHeaders() {}, write() {} } });
  const a = mk(S("s7")), b = mk(A);
  const before = [hub.count("student:s7"), hub.count("admins")];
  student.stream(a.req, a.res); admin.stream(b.req, b.res);
  assert.equal(hub.count("student:s7"), before[0] + 1); assert.equal(hub.count("admins"), before[1] + 1);
  a.req.emit("close"); b.req.emit("close");
  assert.equal(hub.count("student:s7"), before[0]);
});

// ---------- email alerts ----------
test("one email per burst: only the first unread message triggers an email, to the right side", async () => {
  await send("s1", "one"); await send("s1", "two"); await send("s1", "three");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(mail.filter((m) => m[0] === "admins"), [["admins", "Ada Obi"]]);
  await asend("s1", "reply 1"); await asend("s1", "reply 2");
  assert.deepEqual(mail.filter((m) => m[0] === "student"), [["student", "ada@x.com"]]);
  await call(student.markRead, { user: S("s1") });   // the student read it, so the next reply may email again
  await asend("s1", "reply 3");
  assert.equal(mail.filter((m) => m[0] === "student").length, 2);
});
test("a failing live push or email never makes a send fail", async () => {
  const bad = { write() { throw new Error("socket closed"); }, end() {} };
  hub.subscribe("admins", bad);
  assert.equal((await send("s1", "still delivered")).statusCode, 201);
  assert.equal(db.messages.length, 1);
});

// ---------- blocking ----------
test("a blocked student cannot send or upload, still reads the thread, is told live, and administrators can still write to them", async () => {
  await send("s1", "hi");
  const live = listener("student:s1");
  assert.equal((await call(admin.block, { user: A, params: { studentId: "s1" }, body: { reason: "Repeated abusive messages" } })).statusCode, 200);
  assert.deepEqual(live.at(-1), { type: "state", blocked: true });
  const no = await send("s1", "again"); assert.equal(no.statusCode, 403); assert.equal(no.body.code, "MESSAGING_BLOCKED");
  assert.equal((await upload("s1")).statusCode, 403);
  const t = await call(student.thread, { user: S("s1"), query: {} });
  assert.equal(t.body.blocked, true); assert.equal(t.body.messages.length, 1);
  assert.equal((await asend("s1", "Please see the office")).statusCode, 201);
  const view = await call(admin.thread, { user: A, params: { studentId: "s1" }, query: {} });
  assert.equal(view.body.blocked, true); assert.equal(view.body.blockedReason, "Repeated abusive messages");
  assert.equal((await call(admin.block, { user: A, params: { studentId: "t1" }, body: { reason: "Not a student" } })).statusCode, 404);
  await call(admin.unblock, { user: A, params: { studentId: "s1" } });
  assert.equal((await send("s1", "back again")).statusCode, 201);
  assert.deepEqual(audits.filter((a) => a.event.startsWith("message.") && /block/.test(a.event)).map((a) => a.event), ["message.blocked", "message.unblocked"]);
});

// ---------- assigning ----------
test("a conversation can be assigned to an administrator, filtered by 'mine' and 'unassigned', and unassigned again", async () => {
  await send("s1", "q1"); await send("s2", "q2");
  assert.equal((await call(admin.assign, { user: A, params: { studentId: "s1" }, body: { adminId: "me" } })).statusCode, 200);
  assert.equal((await call(admin.assign, { user: A, params: { studentId: "s2" }, body: { adminId: "a2" } })).statusCode, 200);
  const mine = await call(admin.conversations, { user: A, query: { assigned: "me" } });
  assert.deepEqual(mine.body.conversations.map((c) => c.student.name), ["Ada Obi"]); assert.equal(mine.body.conversations[0].assignedToMe, true);
  const all = await call(admin.conversations, { user: A, query: {} });
  assert.equal(all.body.conversations.find((c) => c.student.name === "Bayo Eze").assignedName, "Dayo");
  await call(admin.assign, { user: A, params: { studentId: "s1" }, body: { adminId: null } });
  assert.deepEqual((await call(admin.conversations, { user: A, query: { assigned: "unassigned" } })).body.conversations.map((c) => c.student.name), ["Ada Obi"]);
});
test("only administrators can be assigned", async () => {
  await send("s1", "q");
  for (const adminId of ["t1", "s2", "ghost"]) assert.equal((await call(admin.assign, { user: A, params: { studentId: "s1" }, body: { adminId } })).statusCode, 400);
  assert.deepEqual((await call(admin.admins, { user: A })).body.admins.map((a) => a.name).sort(), ["Chidi Admin", "Dayo Boss"]);
});

// ---------- searching ----------
test("message search needs 3+ letters, treats symbols literally, shows who and a snippet, newest first", async () => {
  await send("s1", "My fee receipt (partial) is attached, please confirm the receipt");
  await send("s2", "When is the next mock?");
  await asend("s1", "Receipt received, thank you");
  assert.deepEqual((await call(admin.searchMessages, { user: A, query: { q: "re" } })).body.results, []);
  const r = await call(admin.searchMessages, { user: A, query: { q: "receipt" } });
  assert.equal(r.body.results.length, 2);
  assert.equal(r.body.results[0].from, "admin"); assert.equal(r.body.results[0].studentName, "Ada Obi");
  assert.match(r.body.results[1].snippet, /receipt/i);
  assert.equal((await call(admin.searchMessages, { user: A, query: { q: "(partial)" } })).body.results.length, 1);
  assert.equal((await call(admin.searchMessages, { user: A, query: { q: ".*." } })).body.results.length, 0);
});

// ---------- attachments ----------
test("a real picture uploads; disguised, oversize, wrong-type and empty files are refused", async () => {
  const ok = await upload("s1");
  assert.equal(ok.statusCode, 201); assert.equal(ok.body.file.contentType, "image/png"); assert.equal(ok.body.file.name, "photo.png");
  assert.equal(db.files[0].attached, false);
  assert.equal(JSON.stringify(ok.body).includes("data"), false);
  assert.equal((await upload("s1", Buffer.from("<script>alert(1)</script>".padEnd(60)), "image/png", "x.png")).statusCode, 400);
  assert.equal((await upload("s1", PNG, "image/jpeg")).statusCode, 400);
  assert.equal((await upload("s1", Buffer.alloc(2 * 1024 * 1024 + 1, 1))).statusCode, 400);
  assert.equal((await upload("s1", {})).statusCode, 400);   // body was not a file at all
  assert.equal(db.files.length, 1);
});
test("a message can carry a file with no text; the list preview names the file", async () => {
  const f = (await upload("s1")).body.file;
  const r = await send("s1", "", { fileIds: [f.id] });
  assert.equal(r.statusCode, 201);
  assert.deepEqual(r.body.message.attachments.map((a) => a.name), ["photo.png"]);
  assert.equal(db.files[0].attached, true);
  assert.equal(db.convs[0].lastMessagePreview, "Attachment: photo.png");
  assert.equal((await send("s1", "")).statusCode, 400);   // neither text nor file
});
test("files can only be attached by their uploader, in their own conversation, once, and at most three at a time", async () => {
  const mine = (await upload("s1")).body.file, theirs = (await upload("s2")).body.file;
  assert.equal((await send("s1", "x", { fileIds: [theirs.id] })).statusCode, 400);            // another student's upload
  assert.equal((await send("s1", "x", { fileIds: ["nope"] })).statusCode, 400);
  assert.equal((await send("s1", "first", { fileIds: [mine.id] })).statusCode, 201);
  assert.equal((await send("s1", "again", { fileIds: [mine.id] })).statusCode, 400);          // already used
  const four = []; for (let i = 0; i < 4; i++) four.push((await upload("s1")).body.file.id);
  assert.equal((await send("s1", "too many", { fileIds: four })).statusCode, 400);
});
test("an administrator can attach a file for a student; it shows up on the student's side", async () => {
  const f = (await aupload("s1")).body.file;
  const r = await asend("s1", "Here is your timetable", { fileIds: [f.id] });
  assert.equal(r.statusCode, 201);
  const seen = await call(student.thread, { user: S("s1"), query: {} });
  assert.equal(seen.body.messages[0].attachments[0].id, f.id);
  assert.equal((await aupload("t1")).statusCode, 404);   // not a student
});
test("downloads: the student gets only their own sent files; admins get any sent file; downloads are forced and never sniffed", async () => {
  const f = (await upload("s1")).body.file;
  assert.equal((await call(files.downloadStudent, { user: S("s1"), params: { id: f.id } })).statusCode, 404);   // not sent yet
  await send("s1", "see file", { fileIds: [f.id] });
  const own = await call(files.downloadStudent, { user: S("s1"), params: { id: f.id } });
  assert.equal(own.statusCode, 200); assert.equal(own.headers["X-Content-Type-Options"], "nosniff");
  assert.match(own.headers["Content-Disposition"], /^attachment;/); assert.equal(own.headers["Cache-Control"], "private, no-store");
  assert.equal(own.sent.length, PNG.length);
  assert.equal((await call(files.downloadStudent, { user: S("s2"), params: { id: f.id } })).statusCode, 404);   // someone else's
  assert.equal((await call(files.downloadAdmin, { user: A, params: { id: f.id } })).statusCode, 200);
  assert.equal((await call(files.downloadAdmin, { user: A, params: { id: "ghost" } })).statusCode, 404);
});
