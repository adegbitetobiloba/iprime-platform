const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./support/teacherFakes");

const users = [], links = [], mats = [];
const User = F.makeModel(users), TeacherAssignment = F.makeModel(links), Material = F.makeModel(mats);
const base = F.baseStubs({ User, TeacherAssignment, Material });
const adminMaterialCalls = [];
base.stubs.adminLibraryMaterialsController = {
  createMaterial: (req, res) => { adminMaterialCalls.push(["create", { ...req.body }]); return res.status(201).json({ ok: true }); },
  updateMaterial: (req, res) => { adminMaterialCalls.push(["update", { ...req.body }]); return res.json({ ok: true }); },
  uploadMaterialPdf: (req, res) => res.json({ ok: true }), addImage: (req, res) => res.json({ ok: true }),
  removeImage: (req, res) => res.json({ ok: true }), reorderImages: (req, res) => res.json({ ok: true }),
};
F.install(base.stubs);
const admin = require("../controllers/adminTeacherController");
const students = require("../controllers/teacherStudentController");
const lib = require("../controllers/teacherLibraryController");

const ADMIN = { id: "f".repeat(24), role: "admin" };
const reset = () => { users.length = 0; links.length = 0; mats.length = 0; base.audit.calls.length = 0; adminMaterialCalls.length = 0; for (const f of Object.values(base.notify)) f.calls.length = 0; };
const teacher = (o) => new User({ firstName: "Ada", lastName: "Obi", email: "t@example.com", role: "teacher", isVerified: true, approval: "pending", ...o });
const student = (o) => new User({ firstName: "Sam", lastName: "Eze", email: "s@example.com", phone: "0800", role: "student", studentId: "PET-1", approval: "approved", ...o });
const decide = async (t, action, note) => { const r = F.res(); await admin.decide({ params: { id: t._id }, body: { action, note }, user: ADMIN }, r); return r; };

test("approve: pending -> approved, audited, teacher emailed, reviewer recorded", async () => {
  reset(); const t = teacher(); users.push(t);
  const r = await decide(t, "approve");
  assert.equal(r.statusCode, 200);
  assert.equal(t.approval, "approved");
  assert.equal(String(t.approvalReview.by), ADMIN.id);
  assert.equal(base.audit.calls.length, 1);
  assert.equal(base.audit.calls[0][1].event, "teacher.approve");
  assert.equal(base.notify.notifyTeacherApproved.calls.length, 1);
});

test("an unverified teacher cannot be approved; a legacy (no approval value) teacher can", async () => {
  reset(); let t = teacher({ isVerified: false }); users.push(t);
  assert.equal((await decide(t, "approve")).statusCode, 409);
  assert.equal(t.approval, "pending");
  reset(); t = teacher({ approval: undefined }); users.push(t);
  assert.equal((await decide(t, "approve")).statusCode, 200);
});

test("reject and suspend need a reason; wrong-state transitions are refused", async () => {
  reset(); const t = teacher(); users.push(t);
  assert.equal((await decide(t, "reject", "")).statusCode, 400);
  assert.equal((await decide(t, "suspend", "x")).statusCode, 409);   // pending cannot be suspended
  assert.equal((await decide(t, "reinstate")).statusCode, 409);      // only suspended can be reinstated
  assert.equal((await decide(t, "reject", "Documents missing")).statusCode, 200);
  assert.equal(t.approval, "rejected");
  assert.equal(base.notify.notifyTeacherRejected.calls.length, 1);
  assert.equal((await decide(t, "reject", "again")).statusCode, 409);
});

test("suspend -> reinstate round trip, and repeating an action is refused", async () => {
  reset(); const t = teacher({ approval: "approved" }); users.push(t);
  assert.equal((await decide(t, "approve")).statusCode, 409);
  assert.equal((await decide(t, "suspend", "")).statusCode, 400);
  assert.equal((await decide(t, "suspend", "Policy breach")).statusCode, 200);
  assert.equal(t.approval, "suspended");
  assert.equal(base.notify.notifyTeacherSuspended.calls.length, 1);
  assert.equal((await decide(t, "suspend", "again")).statusCode, 409);
  assert.equal((await decide(t, "reinstate")).statusCode, 200);
  assert.equal(t.approval, "approved");
  assert.deepEqual(base.audit.calls.map((c) => c[1].event), ["teacher.suspend", "teacher.reinstate"]);
});

test("decisions only work on teachers, and bad ids are a clean 404", async () => {
  reset(); const s = student(); users.push(s);
  assert.equal((await decide(s, "approve")).statusCode, 404);
  assert.equal(s.approval, "approved");
  let r = F.res(), nexted = false;
  admin.idParam({}, r, () => { nexted = true; }, "not-an-id");
  assert.equal(r.statusCode, 404); assert.equal(nexted, false);
});

const assign = async (t, s, subjects) => { const r = F.res(); await admin.assignStudent({ params: { id: t._id }, body: { studentId: String(s._id), subjects }, user: ADMIN }, r); return r; };

test("assignment: needs an approved teacher and a real student; duplicates refused; ending and re-assigning reuses the row", async () => {
  reset(); const t = teacher(), s = student(), other = teacher({ email: "o@example.com", approval: "approved" });
  users.push(t, s, other);
  assert.equal((await assign(t, s)).statusCode, 409);              // teacher still pending
  t.approval = "approved";
  assert.equal((await assign(t, other)).statusCode, 404);          // target is a teacher, not a student
  assert.equal((await assign(t, s, ["Physics"])).statusCode, 201);
  assert.equal((await assign(t, s)).statusCode, 409);              // duplicate
  assert.equal(links.length, 1);

  let r = F.res(); await admin.unassignStudent({ params: { id: t._id, studentId: String(s._id) }, user: ADMIN }, r);
  assert.equal(r.statusCode, 200); assert.equal(links[0].status, "ended");
  r = F.res(); await admin.unassignStudent({ params: { id: t._id, studentId: String(s._id) }, user: ADMIN }, r);
  assert.equal(r.statusCode, 404);
  assert.equal((await assign(t, s)).statusCode, 201);
  assert.equal(links.length, 1); assert.equal(links[0].status, "active");
  assert.deepEqual(base.audit.calls.map((c) => c[1].event), ["teacher.assign", "teacher.unassign", "teacher.assign"]);
});

test("a teacher sees only their own active, approved students, and only minimal fields", async () => {
  reset();
  const t1 = teacher({ approval: "approved" }), t2 = teacher({ email: "t2@example.com", approval: "approved" });
  const a = student({ firstName: "Amy" }), b = student({ email: "b@example.com", firstName: "Ben" }), c = student({ email: "c@example.com", firstName: "Cal", approval: "pending" }), d = student({ email: "d@example.com", firstName: "Dee" });
  users.push(t1, t2, a, b, c, d);
  links.push(
    new TeacherAssignment({ teacherId: t1._id, studentId: a._id, status: "active" }),
    new TeacherAssignment({ teacherId: t1._id, studentId: c._id, status: "active" }),  // student pending approval: hidden
    new TeacherAssignment({ teacherId: t1._id, studentId: d._id, status: "ended" }),   // ended: hidden
    new TeacherAssignment({ teacherId: t2._id, studentId: b._id, status: "active" }),  // someone else's student: hidden
  );
  const r = F.res(); await students.list({ user: { id: t1._id } }, r);
  assert.deepEqual(r.body.students.map((s) => s.firstName), ["Amy"]);
  assert.equal(r.body.students[0].email, undefined);
  assert.equal(r.body.students[0].phone, undefined);
  assert.equal(await students.activeAssignment(t1._id, b._id), null);
  assert.ok(await students.activeAssignment(t1._id, a._id));
});

// ---------- library ----------
const mat = (o) => new Material({ title: "Notes", kind: "notes", source: "text", body: "hello", status: "draft", createdBy: "1".repeat(24), images: [], ...o });
const owned = async (m, user, opts) => { const r = F.res(); let ok = false; await lib.owned(opts)({ params: { id: m._id }, user: { id: user } }, r, () => { ok = true; }); return { ok, r }; };

test("teachers can only edit their OWN, unlocked DRAFTS", async () => {
  reset(); const me = "1".repeat(24);
  const mine = mat(), theirs = mat({ createdBy: "2".repeat(24) }), pub = mat({ status: "published" }), locked = mat({ review: { requestedAt: new Date() } });
  mats.push(mine, theirs, pub, locked);
  assert.equal((await owned(mine, me)).ok, true);
  assert.equal((await owned(theirs, me)).r.statusCode, 404);
  assert.equal((await owned(pub, me)).r.statusCode, 409);
  assert.equal((await owned(locked, me)).r.statusCode, 409);
  assert.equal((await owned(locked, me, { allowLocked: true })).ok, true); // withdrawing is always allowed
  assert.equal((await owned({ _id: "not-an-id" }, me)).r.statusCode, 404);
});

test("create and update strip featured/status before reaching the library code", async () => {
  reset();
  await lib.create({ body: { title: "T", featured: true }, user: { id: "1".repeat(24) } }, F.res());
  await lib.update({ body: { title: "T2", featured: true, status: "published" }, params: { id: "x" }, user: { id: "1".repeat(24) } }, F.res());
  assert.equal("featured" in adminMaterialCalls[0][1], false);
  assert.equal("featured" in adminMaterialCalls[1][1], false);
  assert.equal("status" in adminMaterialCalls[1][1], false);
});

test("submit needs content; once submitted the draft is locked until withdrawn", async () => {
  reset(); const m = mat({ source: "pdf", body: undefined }); mats.push(m);
  let r = F.res(); await lib.submit({ params: { id: m._id }, user: { id: "1".repeat(24) } }, r);
  assert.equal(r.statusCode, 422);
  const t = mat(); mats.push(t);
  r = F.res(); await lib.submit({ params: { id: t._id }, user: { id: "1".repeat(24) } }, r);
  assert.equal(r.statusCode, 200); assert.ok(t.review.requestedAt);
  assert.equal((await owned(t, "1".repeat(24))).r.statusCode, 409);
  r = F.res(); await lib.withdraw({ params: { id: t._id }, user: { id: "1".repeat(24) } }, r);
  assert.equal(t.review.requestedAt, undefined);
  assert.equal((await owned(t, "1".repeat(24))).ok, true);
});

test("teachers can read published material and their own drafts, but not other teachers' drafts", async () => {
  reset(); const me = "1".repeat(24);
  const pub = mat({ status: "published", createdBy: "2".repeat(24) }), mine = mat(), theirs = mat({ createdBy: "2".repeat(24) });
  mats.push(pub, mine, theirs);
  const get = async (m) => { const r = F.res(); await lib.getOne({ params: { id: m._id }, user: { id: me } }, r); return r; };
  assert.equal((await get(pub)).statusCode, 200);
  assert.equal((await get(pub)).body.material.mine, false);
  assert.equal((await get(mine)).body.material.mine, true);
  assert.equal((await get(theirs)).statusCode, 404);
});

test("admin library review: publish needs content, return needs a note, both audited and the teacher is told", async () => {
  reset(); const t = teacher({ approval: "approved" }); users.push(t);
  const m = mat({ createdBy: t._id, review: { requestedAt: new Date() } }); mats.push(m);
  const dec = async (action, note) => { const r = F.res(); await admin.libraryDecision({ params: { id: m._id }, body: { action, note }, user: ADMIN }, r); return r; };
  assert.equal((await dec("return", "")).statusCode, 400);
  assert.equal((await dec("return", "Add the answers")).statusCode, 200);
  assert.equal(m.review.note, "Add the answers"); assert.equal(m.status, "draft");
  assert.equal((await dec("publish")).statusCode, 404); // no longer waiting
  m.review = { requestedAt: new Date() };
  assert.equal((await dec("publish")).statusCode, 200);
  assert.equal(m.status, "published"); assert.equal(m.review.requestedAt, undefined);
  assert.equal(base.notify.notifyTeacherMaterial.calls.length, 2);
  assert.deepEqual(base.audit.calls.map((c) => c[1].event), ["teacher.material.return", "teacher.material.publish"]);
});
