// Runs the REAL bankController (and real roleMiddleware) against in-memory stand-ins for the database.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Module = require("module");

let seq, bankDocs, exams, attemptsFor, users;
const hex = () => String(++seq).padStart(24, "0");

const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : Array.isArray(a) ? a.flatMap((x) => (x == null ? [] : [x[k]])) : a[k]), o);
function matches(doc, f) {
  return Object.entries(f).every(([k, v]) => {
    if (k === "$or") return v.some((c) => matches(doc, c));
    const val = get(doc, k);
    if (v instanceof RegExp) return v.test(String(val ?? ""));
    if (v && typeof v === "object" && "$in" in v) { const one = Array.isArray(val) ? val[0] : val; return v.$in.map(String).includes(String(one === undefined ? null : one)); } // like MongoDB: null matches a missing field
    if (v && typeof v === "object" && "$ne" in v) return String(val ?? null) !== String(v.$ne);
    return Array.isArray(val) ? val.map(String).includes(String(v)) : String(val) === String(v);
  });
}
class Query { constructor(rows) { this.rows = rows; } sort() { return this; } skip(n) { this.rows = this.rows.slice(n); return this; } limit(n) { this.rows = this.rows.slice(0, n); return this; } lean() { return Promise.resolve(this.rows.map((r) => (r.toObject ? r.toObject() : r))); } then(a, b) { return Promise.resolve(this.rows).then(a, b); } }
class Doc {
  constructor(f) { Object.assign(this, JSON.parse(JSON.stringify(f))); if (f.solution) this.solution = f.solution; this._id = f._id || hex(); this.status = this.status || "active"; this.version = this.version || 1; this.updatedAt = new Date(); }
  set(o) { Object.assign(this, o); }
  async save() { return this; }
  toObject() { const { set, save, toObject, ...rest } = this; return { ...rest }; }
}
const FakeBank = {
  find: (f = {}) => new Query(bankDocs.filter((d) => matches(d, f))),
  findById: async (id) => bankDocs.find((d) => d._id === String(id)) || null,
  countDocuments: async (f = {}) => bankDocs.filter((d) => matches(d, f)).length,
  async insertMany(docs) {
    const out = [];
    for (const d of docs) { if (bankDocs.some((x) => x.externalKey === d.externalKey)) { const e = new Error("dup"); e.writeErrors = [{ code: 11000 }]; e.insertedDocs = out; throw e; } const n = new Doc(d); bankDocs.push(n); out.push(n); }
    return out;
  },
  async updateOne({ _id }, upd) { const d = bankDocs.find((x) => x._id === String(_id)); Object.assign(d, upd.$set); d.version = (d.version || 1) + (upd.$inc?.version || 0); },
  aggregate: async () => [],
};
class Q extends Doc { set(o) { Object.assign(this, o); } }
const FakeExam = {
  async findById(id) { return exams.find((e) => e._id === String(id)) || null; },
  find: (f) => new Query(exams.filter((e) => e.questions.some((q) => String(q.bankId) === String(f["questions.bankId"])))),
  countDocuments: async (f) => exams.filter((e) => e.questions.some((q) => String(q.bankId) === String(f["questions.bankId"]))).length,
};
const FakeAttempt = { exists: async ({ examId }) => (attemptsFor.has(String(examId)) ? { _id: "x" } : null) };
const FakeUser = { findById: (id) => ({ select: async () => users[id] || null }) };

const stubs = {
  mongoose: { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) },
  "../models/BankQuestion": FakeBank, "../models/Exam": FakeExam, "../models/Attempt": FakeAttempt, "../models/User": FakeUser,
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /(controllers|middleware)[\\/](bankController|roleMiddleware)\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};
const c = require("../controllers/bankController");
const role = require("../middleware/roleMiddleware");

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ user: { id: "admin1" }, body: {}, params: {}, query: {}, ...req }, r); return r; };
const item = (n, over = {}) => ({ externalId: `CHM-${String(n).padStart(4, "0")}`, subject: "Chemistry", topic: n % 2 ? "Atoms" : "Bonds", text: `Question ${n}`, options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], correctKey: "B", explanation: "Because.", ...over });
const batch = (questions, over = {}) => ({ sessionId: "sess-0001-abcd", questions, allowIncomplete: false, onConflict: "skip", ...over });
const newExam = (over = {}) => { const e = { _id: hex(), title: "Exam", status: "draft", questions: [], async save() { return this; }, ...over }; exams.push(e); return e; };
const eq = (o) => ({ ...o, set(x) { Object.assign(this, x); } });

beforeEach(() => { seq = 0; bankDocs = []; exams = []; attemptsFor = new Set(); users = { admin1: { role: "admin", isVerified: true }, stu1: { role: "student", isVerified: true } }; });

test("authorisation: a non-admin is refused with 403 by the middleware every bank route sits behind", async () => {
  const mw = role("admin");
  for (const id of ["stu1", "nobody"]) {
    const r = res(); let nexted = false;
    await mw({ user: { id } }, r, () => { nexted = true; });
    assert.equal(r.statusCode, 403); assert.equal(nexted, false);
  }
  let ok = false; await mw({ user: { id: "admin1" } }, res(), () => { ok = true; }); assert.ok(ok);
});

test("authorisation (static): every /bank route is registered after router.use(protect, requireRole('admin'))", () => {
  const src = fs.readFileSync(path.join(__dirname, "../routes/adminRoutes.js"), "utf8");
  const guard = src.indexOf('router.use(protect, requireRole("admin"))');
  assert.ok(guard > -1);
  const routes = [...src.matchAll(/router\.(get|post|patch|put|delete)\("\/bank/g)];
  assert.ok(routes.length >= 8);
  for (const m of routes) assert.ok(m.index > guard);
  assert.ok(/app\.use\("\/api\/admin", adminRoutes\)/.test(fs.readFileSync(path.join(__dirname, "../app.js"), "utf8")));
});

test("import stores questions with all fields, and a repeat of the same batch changes nothing (idempotent)", async () => {
  const q = [item(1, { sourceRefs: ["P1"], sourcePage: 4, questionType: "Multiple Choice", extra: { Difficulty: "Easy" } }), item(2), item(3)];
  const a = await call(c.importBatch, { body: batch(q) });
  assert.equal(a.statusCode, 201); assert.equal(a.body.created, 3);
  const b = await call(c.importBatch, { body: batch(q) });
  assert.deepEqual([b.statusCode, b.body.created, b.body.unchanged], [200, 0, 3]);
  assert.equal(bankDocs.length, 3);
  const d = bankDocs[0];
  assert.deepEqual([d.subject, d.topic, d.text, d.correctKey, d.explanation, d.source.page, d.extra.Difficulty, d.usable, d.awaitingSolution], ["Chemistry", "Atoms", "Question 1", "B", "Because.", "4", "Easy", true, false]);
  assert.equal(d.importSession, "sess-0001-abcd");
});

test("invalid questions are rejected with reasons; incomplete ones are stored only when explicitly allowed", async () => {
  const bad = [item(1, { correctKey: null }), item(2, { text: "" }), item(3, { options: [{ key: "A", text: "a" }] }), item(4)];
  const r = await call(c.importBatch, { body: batch(bad) });
  assert.equal(r.body.created, 1); assert.equal(r.body.rejected.length, 3);
  assert.deepEqual(r.body.rejected.map((x) => x.problems[0].code).sort(), ["FEW_OPTIONS", "NO_ANSWER", "NO_TEXT"]);
  const r2 = await call(c.importBatch, { body: batch(bad.slice(0, 3), { allowIncomplete: true }) });
  assert.equal(r2.body.created, 3);
  assert.ok(bankDocs.filter((d) => !d.usable).length === 3);
  assert.ok(bankDocs.find((d) => d.externalId === "CHM-0001").correctKey === undefined, "no answer was invented");
});

test("'needs review' questions are only imported when approved; a repeated ID inside one batch is used once", async () => {
  const r = await call(c.importBatch, { body: batch([item(1, { reviewState: "needs_review" }), item(2, { reviewState: "needs_review", approved: true }), item(3), item(3)]) });
  assert.equal(r.body.created, 2);
  assert.deepEqual(r.body.rejected.map((x) => x.reason).sort(), ["needs_approval", "repeated_in_batch"]);
  assert.equal(bankDocs.find((d) => d.externalId === "CHM-0002").review.status, "approved");
});

test("re-import never overwrites an administrator's edit; a changed, un-edited question is only updated when asked", async () => {
  await call(c.importBatch, { body: batch([item(1), item(2)]) });
  const id1 = bankDocs[0]._id;
  await call(c.edit, { params: { id: id1 }, body: { text: "Edited by admin" } });
  const changed = [item(1, { text: "Changed in file" }), item(2, { text: "Changed in file too" })];
  const skip = await call(c.importBatch, { body: batch(changed) });
  assert.deepEqual([skip.body.updated, skip.body.conflicts.map((x) => x.reason)], [0, ["edited_by_admin", "content_differs"]]);
  const upd = await call(c.importBatch, { body: batch(changed, { onConflict: "update" }) });
  assert.equal(upd.body.updated, 1); assert.equal(upd.body.conflicts[0].reason, "edited_by_admin");
  assert.equal(bankDocs[0].text, "Edited by admin"); assert.equal(bankDocs[1].text, "Changed in file too");
});

test("a parallel request that stored the same question first is counted as already there, not as an error", async () => {
  const realInsert = FakeBank.insertMany;
  FakeBank.insertMany = async (docs) => { const e = new Error("E11000"); e.writeErrors = [{ code: 11000 }]; e.insertedDocs = []; throw e; };
  const r = await call(c.importBatch, { body: batch([item(1)]) });
  FakeBank.insertMany = realInsert;
  assert.equal(r.statusCode, 200); assert.equal(r.body.unchanged, 1);
});

test("list: search, filters and pagination", async () => {
  await call(c.importBatch, { body: batch([...Array.from({ length: 7 }, (_, i) => item(i + 1)), item(8, { correctKey: null, explanation: "" }), item(9, { explanation: "" })], { allowIncomplete: true }) });
  const all = await call(c.list, { query: { limit: "4", page: "2" } });
  assert.deepEqual([all.body.total, all.body.questions.length, all.body.page, all.body.pages], [9, 4, 2, 3]);
  assert.deepEqual((await call(c.list, { query: { flag: "incomplete" } })).body.questions.map((x) => x.externalId), ["CHM-0008"]);
  assert.deepEqual((await call(c.list, { query: { flag: "awaiting_solution" } })).body.questions.map((x) => x.externalId), ["CHM-0009"]);
  assert.equal((await call(c.list, { query: { topic: "Bonds" } })).body.total, 4);
  assert.equal((await call(c.list, { query: { q: "chm-0003" } })).body.total, 1);
  assert.equal((await call(c.list, { query: { q: ".*" } })).body.total, 0, "regex characters in the search are literal");
});

test("admin edit: completes an incomplete question, saves an admin-written solution, bumps the version, and detects stale edits", async () => {
  await call(c.importBatch, { body: batch([item(1, { correctKey: null, explanation: "" })], { allowIncomplete: true }) });
  const id = bankDocs[0]._id;
  assert.equal(bankDocs[0].usable, false);
  const stale = await call(c.edit, { params: { id }, body: { correctKey: "B", expectedVersion: 5 } });
  assert.equal(stale.statusCode, 409);
  const ok = await call(c.edit, { params: { id }, body: { correctKey: "B", solutionText: "Because B.", expectedVersion: 1 } });
  assert.equal(ok.statusCode, 200);
  const d = bankDocs[0];
  assert.deepEqual([d.usable, d.version, d.edited, d.solution.status, String(d.solution.by), d.review.status], [true, 2, true, "admin_written", "admin1", "approved"]);
  assert.ok(d.solution.at instanceof Date);
  assert.equal((await call(c.get, { params: { id: "nope" } })).statusCode, 404);
});

test("archived questions leave the default list and cannot be added to exams; restore brings them back", async () => {
  await call(c.importBatch, { body: batch([item(1), item(2)]) });
  const [a, b] = bankDocs.map((d) => d._id);
  await call(c.archive, { params: { id: a } });
  assert.equal((await call(c.list, { query: {} })).body.total, 1);
  assert.equal((await call(c.list, { query: { status: "archived" } })).body.total, 1);
  const exam = newExam();
  const r = await call(c.addToExam, { body: { examId: exam._id, ids: [a, b] } });
  assert.deepEqual([r.body.added, r.body.skipped.map((s) => s.reason)], [1, ["archived"]]);
  await call(c.restore, { params: { id: a } });
  assert.equal((await call(c.list, { query: {} })).body.total, 2);
});

test("add to exam: snapshots with provenance; skips incomplete and duplicates; refuses published or attempted exams", async () => {
  await call(c.importBatch, { body: batch([item(1), item(2, { correctKey: null })], { allowIncomplete: true }) });
  const [a, b] = bankDocs.map((d) => d._id);
  await call(c.edit, { params: { id: a }, body: { solutionText: "Admin explanation" } });
  const exam = newExam();
  const r = await call(c.addToExam, { body: { examId: exam._id, ids: [a, b] } });
  assert.equal(r.body.added, 1); assert.equal(r.body.skipped[0].reason, "incomplete");
  const snap = exam.questions[0];
  assert.deepEqual([snap.explanation, snap.explanationSource, String(snap.bankId), snap.bankVersion], ["Admin explanation", "admin_written", a, 2]);
  assert.equal((await call(c.addToExam, { body: { examId: exam._id, ids: [a] } })).body.skipped[0].reason, "already_in_exam");
  const pub = newExam({ status: "published" });
  assert.equal((await call(c.addToExam, { body: { examId: pub._id, ids: [a] } })).statusCode, 409);
  const used = newExam(); attemptsFor.add(used._id);
  assert.equal((await call(c.addToExam, { body: { examId: used._id, ids: [a] } })).statusCode, 409);
  assert.equal(pub.questions.length + used.questions.length, 0);
});

test("propagation: bank edits reach DRAFT exams without attempts only; published and attempted exams (and so every stored score) are untouched", async () => {
  await call(c.importBatch, { body: batch([item(1)]) });
  const id = bankDocs[0]._id;
  const mk = (over) => newExam({ ...over, questions: [eq({ bankId: id, text: "Question 1", correctKey: "B", options: [] })] });
  const draft = mk({}), published = mk({ status: "published" }), attempted = mk({}); attemptsFor.add(attempted._id);
  await call(c.edit, { params: { id }, body: { correctKey: "C", text: "Question 1 (fixed)" } });
  assert.equal(draft.questions[0].correctKey, "B", "editing the bank alone changes no exam");
  const r = await call(c.propagate, { params: { id } });
  assert.equal(r.body.updated, 1);
  assert.deepEqual(r.body.skipped.map((s) => s.reason).sort(), ["has_attempts", "published"]);
  assert.deepEqual([draft.questions[0].correctKey, draft.questions[0].text, draft.questions[0].bankVersion], ["C", "Question 1 (fixed)", 2]);
  assert.deepEqual([published.questions[0].correctKey, attempted.questions[0].correctKey], ["B", "B"]);
});

test("propagation refuses a question that is still incomplete", async () => {
  await call(c.importBatch, { body: batch([item(1, { correctKey: null })], { allowIncomplete: true }) });
  assert.equal((await call(c.propagate, { params: { id: bankDocs[0]._id } })).statusCode, 409);
});

// ---------- formatting, audit trail, verification, duplicates ----------
const { publicQuestion } = require("../utils/cbt");

test("formatted content is sanitised on the SERVER; underline survives, scripts do not; plain text is derived from the HTML", async () => {
  const q = item(1, { textHtml: "<p>Same sound as the <u>ed</u> in watched<script>alert(1)</script></p>", text: "IGNORED CLIENT TEXT", options: [{ key: "A", text: "x", html: "<p onclick=\"e()\">looked</p>" }, { key: "B", text: "y", html: "<p>lived</p>" }], explanationHtml: "<p> </p>", explanation: "" });
  await call(c.importBatch, { body: batch([q]) });
  const d = bankDocs[0];
  assert.equal(d.textHtml, "<p>Same sound as the <u>ed</u> in watched</p>");
  assert.equal(d.text, "Same sound as the ed in watched");
  assert.equal(d.options[0].html, "<p>looked</p>");
  assert.equal(d.explanationHtml, undefined);
  assert.equal(d.awaitingSolution, true, "a blank <p> </p> explanation counts as missing");
});

test("editing the plain text of a formatted question removes the (now wrong) formatting; editing something else keeps it", async () => {
  await call(c.importBatch, { body: batch([item(1, { textHtml: "<p>See <u>this</u></p>" })]) });
  const id = bankDocs[0]._id;
  await call(c.edit, { params: { id }, body: { topic: "New topic" } });
  assert.equal(bankDocs[0].textHtml, "<p>See <u>this</u></p>");
  await call(c.edit, { params: { id }, body: { text: "Reworded" } });
  assert.equal(bankDocs[0].textHtml, undefined);
});

test("audit history records who changed what; saving never marks a question verified", async () => {
  await call(c.importBatch, { body: batch([item(1, { sourceStatus: "Needs Review" })]) });
  const id = bankDocs[0]._id;
  await call(c.edit, { params: { id }, req: undefined, body: { correctKey: "C", solutionText: "Because." } });
  const d = bankDocs[0];
  assert.equal(d.sourceStatus, "Needs Review", "the file's own status is kept as found");
  assert.notEqual(d.verification && d.verification.status, "verified");
  const h = d.history[d.history.length - 1];
  assert.deepEqual([h.action, String(h.by), h.version], ["edit", "admin1", 2]);
  assert.deepEqual(h.fields.map((f) => f.field).sort(), ["correctKey", "solution"]);
  assert.deepEqual(h.fields.find((f) => f.field === "correctKey"), { field: "correctKey", from: "B", to: "C" });
});

test("verify is an explicit action, recorded, refused for incomplete questions, and reversible", async () => {
  await call(c.importBatch, { body: batch([item(1), item(2, { correctKey: null })], { allowIncomplete: true }) });
  const [a, b] = bankDocs.map((d) => d._id);
  assert.equal((await call(c.verify, { params: { id: b }, body: { verified: true } })).statusCode, 409);
  const ok = await call(c.verify, { params: { id: a }, body: { verified: true } });
  assert.equal(ok.body.question.verified, true);
  assert.equal(bankDocs[0].verification.status, "verified"); assert.equal(String(bankDocs[0].verification.by), "admin1");
  await call(c.verify, { params: { id: a }, body: { verified: false } });
  assert.equal(bankDocs[0].verification.status, "unverified");
  assert.deepEqual(bankDocs[0].history.map((x) => x.action), ["verify", "unverify"]);
});

test("a question with the same wording and options under a new ID is reported as a possible duplicate, never deleted; an explicit skip is honoured", async () => {
  await call(c.importBatch, { body: batch([item(1)]) });
  const twin = { ...item(1), externalId: "CHM-9999" };
  const r = await call(c.importBatch, { body: batch([twin]) });
  assert.equal(r.body.created, 1); assert.equal(r.body.possibleDuplicates.length, 1);
  assert.equal(bankDocs.length, 2, "both are kept");
  const twin2 = { ...item(1), externalId: "CHM-8888", skipIfDuplicate: true };
  const r2 = await call(c.importBatch, { body: batch([twin2]) });
  assert.deepEqual([r2.body.created, r2.body.skippedDuplicates.length], [0, 1]);
  // same stem but DIFFERENT options is a legitimate repeated stem: not reported
  const r3 = await call(c.importBatch, { body: batch([{ ...item(1), externalId: "CHM-7777", options: [{ key: "A", text: "p" }, { key: "B", text: "q" }] }]) });
  assert.equal(r3.body.possibleDuplicates.length, 0);
});

test("list filters: missing answer, missing explanation, invalid options, diagram, question type, source status", async () => {
  await call(c.importBatch, { body: batch([
    item(1), item(2, { correctKey: null }), item(3, { explanation: "" }), item(4, { options: [{ key: "A", text: "only" }] }),
    item(5, { questionType: "Multiple Choice (diagram-dependent)" }), item(6, { sourceStatus: "Verified" }),
  ], { allowIncomplete: true }) });
  const ids = async (query) => (await call(c.list, { query })).body.questions.map((x) => x.externalId);
  assert.deepEqual(await ids({ flag: "missing_answer" }), ["CHM-0002"]);
  assert.deepEqual(await ids({ flag: "missing_explanation" }), ["CHM-0003"]);
  assert.deepEqual(await ids({ flag: "invalid_options" }), ["CHM-0004"]);
  assert.deepEqual(await ids({ flag: "missing_visual" }), ["CHM-0005"]);
  assert.deepEqual(await ids({ type: "Multiple Choice (diagram-dependent)" }), ["CHM-0005"]);
  assert.deepEqual(await ids({ sourceStatus: "Verified" }), ["CHM-0006"]);
});

test("the student's question carries the formatting but never the answer or explanation", () => {
  const eqn = { _id: "q1", text: "plain", textHtml: "<p>See <u>ed</u></p>", correctKey: "A", explanation: "secret", explanationHtml: "<p>secret</p>", marks: 1, options: [{ key: "A", text: "a", html: "<p>a</p>" }, { key: "F", text: "f" }] };
  const out = publicQuestion(eqn);
  assert.equal(out.textHtml, "<p>See <u>ed</u></p>");
  assert.deepEqual(out.options.map((o) => o.key), ["A", "F"]);
  const json = JSON.stringify(out);
  assert.ok(!json.includes("secret") && !json.includes("correctKey"));
});
