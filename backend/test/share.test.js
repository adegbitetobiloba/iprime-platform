// External share links, the NAME every guest must give, and the per-examination PASSWORD: the real service and gatekeeper.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { hex, collection, jwt, call } = require("./helpers/shareFakes");
const S = require("../utils/shareAccess");
const { makeShareService } = require("../utils/shareService");
const { makeAccess } = require("../utils/examAccess");

const SECRET = "test-secret";
const KEY = "a".repeat(64);
let db, svc, acc, tokenA;
const examId = hex(900);
const exam = (over = {}) => ({ _id: examId, title: "SS3 Physics Mock", subject: "Physics", level: "SS3", durationMinutes: 60, maxAttempts: 1, status: "published", questions: [{ _id: hex(1), marks: 2 }, { _id: hex(2), marks: 2 }], ...over });

function setup({ share = {}, access, examOver } = {}) {
  tokenA = S.newToken();
  db = { exams: [exam(examOver)], access: access ? [{ _id: hex(50), examId, ...access }] : [], shares: [{ _id: hex(300), examId, token: tokenA, mode: "both", uses: 0, ...share }], grants: [], unlocks: [], guests: [], attempts: [] };
  const models = {
    Exam: collection(db.exams), ExamAccess: collection(db.access), ExamShare: collection(db.shares), ShareGrant: collection(db.grants),
    ExamUnlock: collection(db.unlocks), Guest: collection(db.guests, { unique: (g) => (g.contactKey ? `${g.shareId}|${g.contactKey}` : null) }), Attempt: collection(db.attempts),
  };
  svc = makeShareService({ ...models, jwt, getSecret: () => SECRET });
  acc = makeAccess({ ...models, requireRole: (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ error: "no" })), now: () => Date.now(), ttlMs: 0 });
}
const PW = S.hashCode("Prime-2027");
const withPw = { passwordHash: PW.codeHash, passwordSalt: PW.codeSalt, passwordVersion: 3 };
const enter = (body, extra = {}) => call(svc.enter, { params: { token: tokenA }, body: { agree: true, ...body }, ...extra });
beforeEach(() => setup());

// ------------------------------------------------------------ what the link shows
test("info: shows the exam's public facts and what the person must provide, and never secrets", async () => {
  setup({ access: withPw, share: { requireContact: true } });
  const r = await call(svc.info, { params: { token: tokenA } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.state, "open");
  assert.equal(r.body.exam.id, examId);
  assert.deepEqual([r.body.exam.title, r.body.exam.durationMinutes, r.body.exam.questionCount, r.body.exam.totalMarks], ["SS3 Physics Mock", 60, 2, 4]);
  assert.deepEqual([r.body.share.needsPassword, r.body.share.requireContact, r.body.share.mode], [true, true, "both"]);
  const text = JSON.stringify(r.body);
  for (const secret of [PW.codeHash, PW.codeSalt, tokenA, "passwordHash"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
  assert.equal(JSON.stringify((await call(svc.info, { params: { token: tokenA } })).body).includes("correctKey"), false);
});

test("info: a link that cannot be used says why, and a draft exam reveals nothing", async () => {
  for (const [share, examOver, state] of [[{ revokedAt: new Date() }, {}, "revoked"], [{ expiresAt: new Date(Date.now() - 1000) }, {}, "expired"], [{}, { status: "draft" }, "unavailable"]]) {
    setup({ share, examOver });
    const r = await call(svc.info, { params: { token: tokenA } });
    assert.equal(r.body.state, state); assert.equal(r.body.exam, undefined);
  }
  setup({ share: { maxUses: 1, uses: 1 } });
  assert.equal((await call(svc.info, { params: { token: tokenA } })).body.state, "full");
  assert.equal((await call(svc.info, { params: { token: "nope" } })).statusCode, 404);
  assert.equal((await call(svc.info, { params: { token: S.newToken() } })).statusCode, 404);
});

// ------------------------------------------------------------ the NAME is required
test("entering the link REQUIRES a name", async () => {
  for (const body of [{}, { name: "" }, { name: "   " }, { name: "A" }, { name: "12345" }, { name: "<b>x</b>" }, { name: null }]) {
    const r = await enter(body);
    assert.equal(r.statusCode, 400, JSON.stringify(body)); assert.equal(r.body.code, "NAME_REQUIRED"); assert.equal(db.guests.length, 0, "no guest is created without a valid name");
    assert.equal(r.body.token, undefined);
  }
});

test("a valid name gets a guest session limited to this one examination", async () => {
  const r = await enter({ name: "  Ada   Obi " });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.examId, examId);
  const claims = jwt.verify(r.body.token, SECRET);
  assert.deepEqual([claims.role, claims.guest, claims.name, claims.eid, claims.sid, claims.pv], ["guest", true, "Ada Obi", examId, hex(300), 0]);
  assert.equal(claims._expiresIn, "240m", "60-minute exam + 3 hours");
  assert.equal(db.guests.length, 1); assert.equal(db.guests[0].name, "Ada Obi");
  assert.equal(r.body.user.firstName, "Ada Obi"); assert.equal(r.body.user.role, "guest");
  assert.equal(db.shares[0].uses, 1);
});

test("the guest session lasts exam time plus 3 hours, never more than 12 hours", async () => {
  setup({ examOver: { durationMinutes: 600 } });
  assert.equal(jwt.decode((await enter({ name: "Ada Obi" })).body.token)._expiresIn, "720m");
});

test("the person must tick the consent box", async () => {
  const r = await call(svc.enter, { params: { token: tokenA }, body: { name: "Ada Obi" } });
  assert.equal(r.statusCode, 400); assert.equal(r.body.code, "CONSENT_REQUIRED"); assert.equal(db.guests.length, 0);
});

test("a link can also ask for an email address or phone number", async () => {
  setup({ share: { requireContact: true } });
  assert.equal((await enter({ name: "Ada Obi" })).body.code, "CONTACT_REQUIRED");
  assert.equal((await enter({ name: "Ada Obi", contact: "nonsense" })).body.code, "BAD_CONTACT");
  assert.equal((await enter({ name: "Ada Obi", contact: "ada@example.com" })).statusCode, 200);
  setup();
  assert.equal((await enter({ name: "Ada Obi" })).statusCode, 200, "contact is optional unless the link asks for it");
});

// ------------------------------------------------------------ the examination PASSWORD
test("when the exam has a password, a link user must know it: missing, wrong, and wrong case are refused", async () => {
  setup({ access: withPw });
  for (const password of [undefined, "", "wrong", "prime-2027", "Prime-2027 "]) {
    const r = await enter({ name: "Ada Obi", password });
    assert.equal(r.statusCode, 403, String(password)); assert.equal(r.body.code, "PASSWORD_REQUIRED"); assert.equal(db.guests.length, 0, "no guest and no place used");
    assert.equal(db.shares[0].uses, 0);
  }
  const ok = await enter({ name: "Ada Obi", password: "Prime-2027" });
  assert.equal(ok.statusCode, 200);
  assert.equal(jwt.decode(ok.body.token).pv, 3, "the session remembers which version of the password was entered");
});

test("the name is still required even when the password is right", async () => {
  setup({ access: withPw });
  const r = await enter({ name: "", password: "Prime-2027" });
  assert.equal(r.statusCode, 400); assert.equal(r.body.code, "NAME_REQUIRED");
});

test("no password set means link users only need a name", async () => {
  assert.equal((await enter({ name: "Ada Obi" })).statusCode, 200);
});

// ------------------------------------------------------------ limits and modes
test("a link for accounts only refuses guests; a revoked, expired or full link refuses everyone new", async () => {
  setup({ share: { mode: "account" } });
  assert.equal((await enter({ name: "Ada Obi" })).body.code, "ACCOUNT_REQUIRED");
  setup({ share: { revokedAt: new Date() } }); assert.equal((await enter({ name: "Ada Obi" })).statusCode, 410);
  setup({ share: { expiresAt: new Date(Date.now() - 5) } }); assert.equal((await enter({ name: "Ada Obi" })).statusCode, 410);
  setup({ examOver: { status: "draft" } }); assert.equal((await enter({ name: "Ada Obi" })).statusCode, 403);
  setup({ share: { maxUses: 1, uses: 1 } }); assert.equal((await enter({ name: "Ada Obi" })).statusCode, 409);
});

test("the person limit is exact, even when many people enter at the same instant", async () => {
  setup({ share: { maxUses: 3 } });
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => enter({ name: `Student Number${"abcdefghijkl"[i]}` })));
  assert.equal(results.filter((r) => r.statusCode === 200).length, 3);
  assert.equal(results.filter((r) => r.statusCode === 409).length, 9);
  assert.equal(db.guests.length, 3); assert.equal(db.shares[0].uses, 3);
});

test("the same person coming back (same contact) is the same guest, uses no extra place, and cannot reset their attempts", async () => {
  setup({ share: { maxUses: 2, requireContact: true } });
  const a = await enter({ name: "Ada Obi", contact: "Ada@Example.com" });
  const b = await enter({ name: "Ada Obi", contact: "ada@example.com" });
  assert.equal(jwt.decode(a.body.token).id, jwt.decode(b.body.token).id);
  assert.equal(db.guests.length, 1); assert.equal(db.shares[0].uses, 1);
  const c = await enter({ name: "Tunde Bello", contact: "tunde@example.com" });
  assert.notEqual(jwt.decode(c.body.token).id, jwt.decode(a.body.token).id);
});

// ------------------------------------------------------------ signed-in accounts using a link
test("a signed-in account can open a link; doing it twice uses one place; guest-only links refuse accounts", async () => {
  setup({ share: { maxUses: 1 } });
  const user = { id: hex(7), role: "student" };
  assert.equal((await call(svc.redeem, { params: { token: tokenA }, user })).body.examId, examId);
  assert.equal((await call(svc.redeem, { params: { token: tokenA }, user })).statusCode, 200);
  assert.equal(db.shares[0].uses, 1); assert.equal(db.grants.length, 1);
  assert.equal((await call(svc.redeem, { params: { token: tokenA }, user: { id: hex(8), role: "student" } })).statusCode, 409, "full");
  setup({ share: { mode: "guest" } });
  assert.equal((await call(svc.redeem, { params: { token: tokenA }, user })).body.code, "GUEST_ONLY");
});

// ------------------------------------------------------------ the password for signed-in students
test("status and unlock: a student must enter the examination password once; changing it asks everyone again", async () => {
  setup({ access: withPw });
  const user = { id: hex(7), role: "student" };
  const st = () => call(svc.examStatus, { params: { id: examId }, user });
  assert.deepEqual([(await st()).body.passwordRequired, (await st()).body.unlocked], [true, false]);
  assert.equal((await call(svc.unlock, { params: { id: examId }, user, body: { password: "nope" } })).statusCode, 403);
  assert.equal((await st()).body.unlocked, false);
  assert.equal((await call(svc.unlock, { params: { id: examId }, user, body: { password: "Prime-2027" } })).statusCode, 200);
  assert.equal((await st()).body.unlocked, true);
  db.access[0].passwordVersion = 4; // the examiner changes the password
  assert.equal((await st()).body.unlocked, false);
  const admin = { id: hex(9), role: "admin" };
  assert.equal((await call(svc.examStatus, { params: { id: examId }, user: admin })).body.unlocked, true, "examiners are never asked");
});

test("unlock: no password set is fine; guests are told the password goes in at the link; draft exams are hidden", async () => {
  const user = { id: hex(7), role: "student" };
  assert.equal((await call(svc.unlock, { params: { id: examId }, user, body: {} })).body.passwordRequired, false);
  setup({ access: withPw });
  const g = await call(svc.unlock, { params: { id: examId }, user: { id: hex(60), role: "guest", guest: true, eid: examId }, body: { password: "Prime-2027" } });
  assert.equal(g.statusCode, 409); assert.equal(g.body.code, "USE_LINK");
  setup({ access: withPw, examOver: { status: "draft" } });
  assert.equal((await call(svc.unlock, { params: { id: examId }, user, body: { password: "Prime-2027" } })).statusCode, 404);
});

// ------------------------------------------------------------ the gatekeeper on the existing exam routes
const nextCalled = () => { let called = false; return { next: () => { called = true; }, was: () => called }; };
const gate = async (fn, req) => { const r = require("./helpers/shareFakes").res(); const n = nextCalled(); await fn({ params: {}, method: "GET", path: "/", headers: {}, originalUrl: "/", protocol: "https", get: () => "api.example.com", ...req }, r, n.next); return { r, passed: n.was() }; };
const guestUser = (over = {}) => ({ id: hex(60), role: "guest", guest: true, eid: examId, sid: hex(300), pv: 0, ...over });
const student = (over = {}) => ({ id: hex(7), role: "student", ...over });
const startReq = (user, extra = {}) => ({ params: { id: examId }, method: "POST", path: "/start", user, ...extra });

test("gate: a guest can only use their one examination, never the list or another exam", async () => {
  const g = guestUser();
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: "/exams" })).r.statusCode, 403);
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: `/exams/${hex(901)}/start` })).r.statusCode, 404);
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: `/exams/${examId}` })).passed, true);
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: `/exams/${examId}/start` })).passed, true);
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: "/attempts/abc/answers" })).passed, true);
  assert.equal((await gate(acc.studentOrGuest, { user: g, path: "/library/anything" })).r.statusCode, 403);
  assert.equal((await gate(acc.studentOrGuest, { user: student(), path: "/exams" })).passed, true, "students are unaffected");
  assert.equal((await gate(acc.studentOrGuest, { user: { id: "x", role: "parent" }, path: "/exams" })).r.statusCode, 403, "other roles are still refused as before");
});

test("gate: starting needs the examination password, for students and guests alike; resuming does not", async () => {
  setup({ access: withPw });
  let r = await gate(acc.examGate, startReq(student()));
  assert.equal(r.r.statusCode, 403); assert.equal(r.r.body.code, "PASSWORD_REQUIRED");
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student() })).passed, true, "the intro page itself is readable");
  db.unlocks.push({ examId, userId: hex(7), version: 3 });
  assert.equal((await gate(acc.examGate, startReq(student()))).passed, true);
  db.unlocks[0].version = 2; // stale
  assert.equal((await gate(acc.examGate, startReq(student()))).r.statusCode, 403);
  db.attempts.push({ _id: hex(800), examId, userId: hex(7), status: "in_progress" });
  assert.equal((await gate(acc.examGate, startReq(student()))).passed, true, "someone already sitting the exam is never locked out");
  db.attempts.length = 0;
  assert.equal((await gate(acc.examGate, startReq(guestUser({ pv: 3 })))).passed, true);
  r = await gate(acc.examGate, startReq(guestUser({ pv: 2 })));
  assert.equal(r.r.statusCode, 403); assert.match(r.r.body.error, /changed/);
  assert.equal((await gate(acc.examGate, startReq({ id: hex(9), role: "admin" }))).passed, true, "examiners are never asked");
});

test("gate: no password set means nothing extra is asked", async () => {
  assert.equal((await gate(acc.examGate, startReq(student()))).passed, true);
  assert.equal((await gate(acc.examGate, startReq(guestUser()))).passed, true);
});

test("gate: a link that has been withdrawn stops new starts by guests but not people already sitting", async () => {
  db.shares[0].revokedAt = new Date();
  const r = await gate(acc.examGate, startReq(guestUser()));
  assert.equal(r.r.statusCode, 403); assert.equal(r.r.body.code, "LINK_closed");
  assert.equal((await gate(acc.attemptGate, { params: { id: hex(800) }, method: "PUT", path: "/answers", user: guestUser() })).passed, true);
});

test("gate: link-only examinations are invisible and unreachable without a live link", async () => {
  setup({ access: { listed: false } });
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student() })).r.statusCode, 404);
  db.grants.push({ _id: hex(1), shareId: hex(300), examId, userId: hex(7) });
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student() })).passed, true);
  db.shares[0].revokedAt = new Date();
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student() })).r.statusCode, 404, "a withdrawn link stops working");
  db.attempts.push({ _id: hex(801), examId, userId: hex(7), status: "in_progress" });
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student() })).passed, true, "but someone already sitting it keeps access");
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: { id: hex(9), role: "admin" } })).passed, true);
});

test("gate: the list hides link-only exams, except for accounts that opened a link to them", async () => {
  setup({ access: { listed: false } });
  const run = async (user) => { const r = require("./helpers/shareFakes").res(); const n = nextCalled(); await acc.hideUnlisted({ user }, r, n.next); r.json({ exams: [{ id: examId, title: "Hidden" }, { id: hex(901), title: "Public" }] }); return r.body.exams.map((e) => e.title); };
  assert.deepEqual(await run(student()), ["Public"]);
  db.grants.push({ _id: hex(1), shareId: hex(300), examId, userId: hex(7) });
  assert.deepEqual(await run(student()), ["Hidden", "Public"]);
  assert.deepEqual(await run({ id: hex(9), role: "admin" }), ["Hidden", "Public"]);
});

// ------------------------------------------------------------ locked browser on the real routes
const sebHeaders = (url, host = "api.example.com") => ({ "x-safeexambrowser-requesthash": crypto.createHash("sha256").update(`https://${host}${url}` + KEY).digest("hex") });
const lockedAccess = { lockedBrowser: { required: true, browserExamKeys: [KEY], configKeys: [] } };

test("locked browser: starting outside Safe Exam Browser is refused with a clear message; inside it works", async () => {
  setup({ access: lockedAccess });
  const url = `/api/exams/${examId}/start`;
  let r = await gate(acc.examGate, startReq(student(), { originalUrl: url }));
  assert.equal(r.r.statusCode, 403); assert.equal(r.r.body.code, "LOCKED_BROWSER_REQUIRED"); assert.match(r.r.body.error, /Safe Exam Browser/);
  assert.equal((await gate(acc.examGate, startReq(student(), { originalUrl: url, headers: sebHeaders(url) }))).passed, true);
  assert.equal((await gate(acc.examGate, { params: { id: examId }, method: "GET", path: "/", user: student(), originalUrl: `/api/exams/${examId}` })).passed, true, "the intro page can be read anywhere");
});

test("locked browser: the whole attempt must stay in the locked browser; the result can be read anywhere; examiners are exempt", async () => {
  setup({ access: lockedAccess });
  db.attempts.push({ _id: hex(802), examId, userId: hex(7), status: "in_progress" });
  const url = `/api/attempts/${hex(802)}/answers`;
  const base = { params: { id: hex(802) }, method: "PUT", path: "/answers", user: student(), originalUrl: url };
  assert.equal((await gate(acc.attemptGate, base)).r.statusCode, 403);
  assert.equal((await gate(acc.attemptGate, { ...base, headers: sebHeaders(url) })).passed, true);
  assert.equal((await gate(acc.attemptGate, { ...base, path: "/result", originalUrl: `/api/attempts/${hex(802)}/result` })).passed, true);
  assert.equal((await gate(acc.attemptGate, { ...base, user: { id: hex(9), role: "admin" } })).passed, true);
  assert.equal((await gate(acc.attemptGate, { ...base, params: { id: hex(899) } })).passed, true, "unknown attempts fall through to the controller's own 404");
});

test("locked browser: guests are held to it as well", async () => {
  setup({ access: lockedAccess });
  const url = `/api/exams/${examId}/start`;
  assert.equal((await gate(acc.examGate, startReq(guestUser(), { originalUrl: url }))).r.body.code, "LOCKED_BROWSER_REQUIRED");
  assert.equal((await gate(acc.examGate, startReq(guestUser(), { originalUrl: url, headers: sebHeaders(url) }))).passed, true);
  assert.equal((await enter({ name: "Ada Obi" })).statusCode, 403, "and cannot even enter the link outside it");
  const e = await call(svc.enter, { params: { token: tokenA }, body: { agree: true, name: "Ada Obi" }, originalUrl: `/api/share/${tokenA}/enter`, protocol: "https", get: () => "api.example.com", headers: sebHeaders(`/api/share/${tokenA}/enter`) });
  assert.equal(e.statusCode, 200);
});

test("locked browser: the link page tells the person whether their browser is accepted", async () => {
  setup({ access: lockedAccess });
  const url = `/api/share/${tokenA}`;
  const no = await call(svc.info, { params: { token: tokenA }, originalUrl: url, protocol: "https", get: () => "api.example.com" });
  assert.deepEqual(no.body.lockedBrowser, { required: true, detected: false, ok: false });
  const yes = await call(svc.info, { params: { token: tokenA }, originalUrl: url, protocol: "https", get: () => "api.example.com", headers: sebHeaders(url) });
  assert.deepEqual(yes.body.lockedBrowser, { required: true, detected: true, ok: true });
  assert.ok(!JSON.stringify(yes.body).includes(KEY));
});

test("a full link still lets people who are already in come back, but refuses new people", async () => {
  setup({ share: { maxUses: 1, requireContact: true } });
  assert.equal((await enter({ name: "Ada Obi", contact: "ada@example.com" })).statusCode, 200);
  assert.equal((await enter({ name: "Ada Obi", contact: "ada@example.com" })).statusCode, 200, "Ada returns to resume");
  assert.equal((await enter({ name: "Tunde Bello", contact: "tunde@example.com" })).statusCode, 409, "a new person is refused");
  assert.equal(db.guests.length, 1);
});
