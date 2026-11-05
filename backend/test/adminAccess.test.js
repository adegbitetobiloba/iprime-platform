const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { hex, collection, call } = require("./helpers/shareFakes");
const S = require("../utils/shareAccess");
const { makeAdminAccessService } = require("../utils/adminAccessService");

const examId = hex(900), KEY = "a".repeat(64);
let db, svc, audits, invalidated;
beforeEach(() => {
  db = { exams: [{ _id: examId, title: "T", status: "draft" }], access: [], shares: [], grants: [], guests: [], users: [] };
  audits = []; invalidated = [];
  svc = makeAdminAccessService({ Exam: collection(db.exams), ExamAccess: collection(db.access), ExamShare: collection(db.shares), ShareGrant: collection(db.grants), Guest: collection(db.guests), User: collection(db.users), audit: async (req, e) => { audits.push(e); }, invalidate: (id) => invalidated.push(id) });
});
const admin = { id: hex(9), role: "admin" };
const R = (fn, req) => call(fn, { user: admin, params: { id: examId }, ...req });

test("the examination password: set, change (everyone asked again), remove; stored only as a hash and never shown", async () => {
  assert.equal((await R(svc.putPassword, { body: { password: "abc" } })).statusCode, 400);
  assert.equal((await R(svc.putPassword, { body: { password: "    " } })).statusCode, 400);
  assert.equal((await R(svc.putPassword, { body: { password: "x".repeat(65) } })).statusCode, 400);
  assert.equal(db.access.length, 0);
  const r = await R(svc.putPassword, { body: { password: "Prime-2027" } });
  assert.equal(r.statusCode, 200); assert.equal(r.body.password.set, true);
  assert.equal(db.access[0].passwordVersion, 1);
  assert.ok(S.verifyCode("Prime-2027", { codeHash: db.access[0].passwordHash, codeSalt: db.access[0].passwordSalt }));
  assert.ok(!JSON.stringify(db.access).includes("Prime-2027"), "the password itself is never stored");
  await R(svc.putPassword, { body: { password: "NewOne-1" } });
  assert.equal(db.access[0].passwordVersion, 2);
  const g = await R(svc.get, {});
  assert.deepEqual(g.body.access.password.set, true); assert.ok(!JSON.stringify(g.body).includes(db.access[0].passwordHash));
  const d = await R(svc.deletePassword, {});
  assert.equal(d.body.password.set, false); assert.equal(db.access[0].passwordVersion, 3);
  assert.equal(JSON.stringify(audits).includes("NewOne-1"), false, "the audit log never holds the password");
  assert.deepEqual(audits.map((a) => a.event), ["password.set", "password.set", "password.removed"]);
  assert.ok(invalidated.length >= 3);
});

test("who can find the exam, and the locked-browser keys: validated so a mistake cannot lock every student out", async () => {
  const put = (body) => R(svc.putAccess, { body });
  assert.equal((await put({ listed: "no" })).statusCode, 400);
  assert.equal((await put({ lockedBrowser: { required: true, browserExamKeys: [], configKeys: [] } })).statusCode, 400, "required with no keys");
  assert.equal((await put({ lockedBrowser: { required: true, browserExamKeys: ["short"] } })).statusCode, 400, "malformed key");
  assert.equal(db.access.length, 0);
  const ok = await put({ listed: false, lockedBrowser: { required: true, browserExamKeys: [KEY.toUpperCase(), KEY], configKeys: [] } });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual([ok.body.access.listed, ok.body.access.lockedBrowser.required, ok.body.access.lockedBrowser.browserExamKeys], [false, true, [KEY]]);
  assert.equal((await put({ lockedBrowser: { required: false, browserExamKeys: [], configKeys: [] } })).statusCode, 200, "switching it off needs no keys");
  assert.ok(!JSON.stringify(audits).includes(KEY), "keys are never logged");
  assert.equal((await R(svc.get, { params: { id: "nope" } })).statusCode, 404);
  assert.equal((await R(svc.get, { params: { id: hex(1) } })).statusCode, 404);
});

test("share links: created with safe options, withdrawn on request, and the log never holds the link", async () => {
  assert.equal((await R(svc.createShare, { body: { mode: "everyone" } })).statusCode, 400);
  assert.equal((await R(svc.createShare, { body: { expiresAt: "2020-01-01" } })).statusCode, 400);
  assert.equal((await R(svc.createShare, { body: { maxUses: 0 } })).statusCode, 400);
  assert.equal((await R(svc.createShare, { body: { maxUses: 2.5 } })).statusCode, 400);
  assert.equal(db.shares.length, 0);
  const r = await R(svc.createShare, { body: { label: "WhatsApp group", mode: "guest", requireContact: true, maxUses: 100, expiresAt: new Date(Date.now() + 86400000).toISOString() } });
  assert.equal(r.statusCode, 201);
  assert.ok(S.looksLikeToken(r.body.share.token)); assert.equal(r.body.share.state, "open"); assert.equal(r.body.share.requireContact, true);
  assert.ok(!JSON.stringify(audits).includes(r.body.share.token));
  const acct = await R(svc.createShare, { body: { mode: "account", requireContact: true } });
  assert.equal(acct.body.share.requireContact, false, "contact only applies to guests");
  const list = await R(svc.get, {});
  assert.equal(list.body.shares.length, 2);
  await call(svc.revokeShare, { user: admin, params: { shareId: r.body.share.id } });
  assert.equal(db.shares[0].revokedAt instanceof Date, true);
  assert.equal((await R(svc.get, {})).body.shares.find((s) => s.id === r.body.share.id).state, "revoked");
  assert.equal((await call(svc.revokeShare, { user: admin, params: { shareId: "bad" } })).statusCode, 404);
});

test("entries: the examiner sees the names guests typed and which accounts used the link", async () => {
  const s = await R(svc.createShare, { body: {} });
  db.guests.push({ _id: hex(61), shareId: db.shares[0]._id, name: "Ada Obi", contact: "ada@x.ng", createdAt: new Date() });
  db.users.push({ _id: hex(7), firstName: "Tunde", lastName: "Bello", studentId: "PX-1" });
  db.grants.push({ _id: hex(2), shareId: db.shares[0]._id, userId: hex(7), createdAt: new Date() });
  const r = await call(svc.entries, { user: admin, params: { shareId: s.body.share.id } });
  assert.deepEqual([r.body.guests[0].name, r.body.guests[0].contact, r.body.accounts[0].name], ["Ada Obi", "ada@x.ng", "Tunde Bello"]);
});
