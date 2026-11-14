const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./support/teacherFakes");

const users = [], links = [], groups = [], enrols = [], subs = [], courses = [], modules = [], lessons = [], exams = [], attempts = [], mats = [];
const User = F.makeModel(users), TeacherAssignment = F.makeModel(links), TeacherGroup = F.makeModel(groups), Enrolment = F.makeModel(enrols);
const TeacherSubmission = F.makeModel(subs), Course = F.makeModel(courses), CourseModule = F.makeModel(modules), Lesson = F.makeModel(lessons), Exam = F.makeModel(exams), Attempt = F.makeModel(attempts), Material = F.makeModel(mats);
// The real database refuses a second OPEN submission for the same item (partial unique index); the stand-in does the same.
const origCreate = TeacherSubmission.create;
TeacherSubmission.create = async (d) => { if (subs.some((s) => s.kind === d.kind && String(s.refId) === String(d.refId) && s.status === "pending")) { const e = new Error("dup"); e.code = 11000; throw e; } return origCreate(d); };

const base = F.baseStubs({ User, TeacherAssignment, Material, extra: { Enrolment, TeacherGroup, TeacherSubmission, Course, CourseModule, Lesson, Exam, Attempt } });
const published = [];
const libCalls = [], examCalls = [];
base.stubs.adminLibraryController = { setCourseStatus: async (req, res) => { libCalls.push(req.params.id); return libCalls.fail ? res.status(422).json({ error: "This course is not ready to publish.", errors: ["Add a course description."] }) : res.json({ course: { status: "published" } }); } };
base.stubs.adminExamController = { publish: async (req, res) => { examCalls.push(req.params.id); return res.json({ exam: { status: "published" } }); } };
base.stubs["utils/library"] = { publishProblems: (c, ls) => (ls.length ? [] : ["Add at least one lesson."]) };
F.install(base.stubs);

const access = require("../utils/teacherAccess");
const students = require("../controllers/teacherStudentController");
const admin = require("../controllers/adminTeacherController");
const courseC = require("../controllers/teacherCourseController");
const examC = require("../controllers/teacherExamController");
const overview = require("../controllers/teacherOverviewController");

const ADMIN = { id: "f".repeat(24), role: "admin" };
const reset = () => { for (const a of [users, links, groups, enrols, subs, courses, modules, lessons, exams, attempts, mats]) a.length = 0; base.audit.calls.length = 0; for (const f of Object.values(base.notify)) f.calls.length = 0; libCalls.length = 0; examCalls.length = 0; libCalls.fail = false; };
const teacher = (o) => new User({ firstName: "Ada", lastName: "Obi", email: "t@example.com", role: "teacher", isVerified: true, approval: "approved", ...o });
const student = (n, o) => new User({ firstName: n, lastName: "Eze", email: `${n}@example.com`, role: "student", studentId: `PET-${n}`, approval: "approved", ...o });
const enrol = (s, subjectsRegistered, o) => new Enrolment({ userId: s._id, status: "approved", subjectsRegistered, ...o });

// ---------- who a teacher may see ----------
test("subject group: every APPROVED enrolment registered for the subject is visible, case-insensitively, and nothing else", async () => {
  reset();
  const t = teacher(), a = student("Amy"), b = student("Ben"), c = student("Cal"), d = student("Dee"), e = student("Eli");
  users.push(t, a, b, c, d, e);
  enrols.push(enrol(a, ["Chemistry", "Biology"]), enrol(b, ["chemistry"]), enrol(c, ["Physics"]), enrol(d, ["Chemistry"], { status: "submitted" }));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "active" }));
  const map = await access.visibleStudents(t._id);
  assert.deepEqual([...map.keys()].sort(), [String(a._id), String(b._id)].sort());
  assert.equal(map.has(String(c._id)), false); // other subject
  assert.equal(map.has(String(d._id)), false); // enrolment not approved
  assert.equal(map.has(String(e._id)), false); // not enrolled at all
  const acc = await access.accessFor(t._id, a._id);
  assert.deepEqual([...acc.subjects], ["chemistry"]);  // limited to the group's subject, not Biology
});

test("an ended group, another teacher's group and a different programme give no access", async () => {
  reset();
  const t = teacher(), o = teacher({ email: "o@example.com" }), a = student("Amy");
  users.push(t, o, a);
  const progA = "a".repeat(24), progB = "b".repeat(24);
  enrols.push(enrol(a, ["Chemistry"], { programmeId: progA }));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "ended" }));
  groups.push(new TeacherGroup({ teacherId: o._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: progB, programmeId: progB, status: "active" }));
  assert.equal((await access.accessFor(t._id, a._id)).ok, false);
  assert.equal((await access.accessFor(o._id, a._id)).ok, false); // wrong programme
  groups.push(new TeacherGroup({ teacherId: o._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: progA, programmeId: progA, status: "active" }));
  assert.equal((await access.accessFor(o._id, a._id)).ok, true);
});

test("a direct assignment with no subjects sees everything; with subjects it is limited; both together widen to everything", async () => {
  reset();
  const t = teacher(), a = student("Amy"), b = student("Ben"), c = student("Cal");
  users.push(t, a, b, c);
  links.push(new TeacherAssignment({ teacherId: t._id, studentId: a._id, status: "active" }));
  links.push(new TeacherAssignment({ teacherId: t._id, studentId: b._id, status: "active", subjects: ["Physics"] }));
  links.push(new TeacherAssignment({ teacherId: t._id, studentId: c._id, status: "active", subjects: ["Physics"] }));
  enrols.push(enrol(c, ["Chemistry"]));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "active" }));
  assert.equal((await access.accessFor(t._id, a._id)).subjects, null);
  assert.deepEqual([...(await access.accessFor(t._id, b._id)).subjects], ["physics"]);
  assert.deepEqual([...(await access.accessFor(t._id, c._id)).subjects].sort(), ["chemistry", "physics"]);
});

test("teacher student list: includes group students, hides unapproved ones, exposes no contact details", async () => {
  reset();
  const t = teacher(), a = student("Amy"), b = student("Ben", { approval: "pending" });
  users.push(t, a, b);
  enrols.push(enrol(a, ["Chemistry"]), enrol(b, ["Chemistry"]));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "active" }));
  const r = F.res(); await students.list({ user: { id: t._id } }, r);
  assert.deepEqual(r.body.students.map((s) => s.firstName), ["Amy"]);
  assert.deepEqual(r.body.students[0].via, ["Chemistry"]);
  assert.equal(r.body.students[0].email, undefined);
  assert.equal(await students.access(t._id, "not-an-id"), null);
});

// ---------- the v14 analytics controller, patched to honour groups ----------
test("analytics: group students are visible, limited to the group subject; strangers are a plain 404", async () => {
  reset();
  const seen = [];
  const stubs2 = { ...base.stubs, "utils/teacherAnalytics": { studentView: ({ subjects }) => { seen.push(subjects); return { restricted: subjects.length > 0, analytics: { history: [] }, summary: { attempts: 0 } }; } }, "utils/analytics": {}, "utils/cohortAnalytics": {} };
  const restore = F.install(stubs2);
  delete require.cache[require.resolve("../controllers/teacherAnalyticsController")];
  const ta = require("../controllers/teacherAnalyticsController");
  const t = teacher(), a = student("Amy"), x = student("Xan");
  users.push(t, a, x);
  enrols.push(enrol(a, ["Chemistry"]));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "active" }));
  let r = F.res(); await ta.list({ user: { id: t._id } }, r);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body.students.map((s) => s.firstName), ["Amy"]);
  assert.deepEqual(r.body.students[0].subjects, ["chemistry"]);
  r = F.res(); await ta.one({ user: { id: t._id }, params: { studentId: String(a._id) } }, r);
  assert.equal(r.statusCode, 200); assert.deepEqual(r.body.scope.subjects, ["chemistry"]); assert.equal(r.body.scope.restricted, true);
  r = F.res(); await ta.one({ user: { id: t._id }, params: { studentId: String(x._id) } }, r);
  assert.equal(r.statusCode, 404);
  restore(); F.install(base.stubs);
});

// ---------- admin: groups ----------
test("admin groups: needs an approved teacher, refuses duplicates, previews the count, reactivates, audits", async () => {
  reset();
  const t = teacher({ approval: "pending" }), a = student("Amy"), b = student("Ben");
  users.push(t, a, b); enrols.push(enrol(a, ["Chemistry"]), enrol(b, ["chemistry"]));
  const add = async (subject, programmeId) => { const r = F.res(); await admin.addGroup({ params: { id: t._id }, body: { subject, programmeId }, user: ADMIN }, r); return r; };
  assert.equal((await add("Chemistry")).statusCode, 409);                 // teacher not approved yet
  t.approval = "approved";
  let pr = F.res(); await admin.groupPreview({ query: { subject: "CHEMISTRY" } }, pr);
  assert.equal(pr.body.students, 2);
  pr = F.res(); await admin.groupPreview({ query: { subject: "x" } }, pr); assert.equal(pr.statusCode, 400);
  const r1 = await add("Chemistry"); assert.equal(r1.statusCode, 201); assert.equal(r1.body.group.students, 2);
  assert.equal((await add("chemistry")).statusCode, 409);                 // same rule, different case
  let r = F.res(); await admin.listGroups({ params: { id: t._id } }, r); assert.equal(r.body.groups.length, 1);
  r = F.res(); await admin.removeGroup({ params: { id: t._id, groupId: groups[0]._id }, user: ADMIN }, r); assert.equal(r.statusCode, 200);
  r = F.res(); await admin.removeGroup({ params: { id: t._id, groupId: groups[0]._id }, user: ADMIN }, r); assert.equal(r.statusCode, 404);
  assert.equal((await add("Chemistry")).statusCode, 201); assert.equal(groups.length, 1); // reused the row
  assert.deepEqual(base.audit.calls.map((c) => c[1].event), ["teacher.group.add", "teacher.group.remove", "teacher.group.add"]);
  r = F.res(); await admin.subjectOptions({}, r); assert.deepEqual(r.body.subjects, ["Chemistry"]); // "chemistry" folded into one
});

// ---------- teacher courses ----------
const course = (o) => new Course({ title: "Acids", description: "d", status: "draft", createdBy: "1".repeat(24), ...o });
const runGuard = async (g, id, user) => { const r = F.res(); let ok = false; await g({ params: { id }, user: { id: user } }, r, () => { ok = true; }); return { ok, r }; };
const ME = "1".repeat(24);

test("courses: only your own, draft, unlocked course can be changed; modules and lessons are checked through their course", async () => {
  reset();
  const mine = course(), theirs = course({ createdBy: "2".repeat(24) }), pub = course({ status: "published" }), locked = course();
  courses.push(mine, theirs, pub, locked);
  subs.push(new TeacherSubmission({ kind: "course", refId: locked._id, teacherId: ME, status: "pending" }));
  const m1 = new CourseModule({ course: mine._id }), m2 = new CourseModule({ course: theirs._id }); modules.push(m1, m2);
  const l1 = new Lesson({ course: mine._id, module: m1._id }), l2 = new Lesson({ course: theirs._id, module: m2._id }); lessons.push(l1, l2);
  assert.equal((await runGuard(courseC.guard(), mine._id, ME)).ok, true);
  assert.equal((await runGuard(courseC.guard(), theirs._id, ME)).r.statusCode, 404);
  assert.equal((await runGuard(courseC.guard(), pub._id, ME)).r.statusCode, 409);
  assert.equal((await runGuard(courseC.guard(), locked._id, ME)).r.statusCode, 409);
  assert.equal((await runGuard(courseC.guard({ allowLocked: true }), locked._id, ME)).ok, true);
  assert.equal((await runGuard(courseC.guard({ readOnly: true }), pub._id, ME)).ok, true); // your own published course can still be viewed
  assert.equal((await runGuard(courseC.guard({ via: "module" }), m1._id, ME)).ok, true);
  assert.equal((await runGuard(courseC.guard({ via: "module" }), m2._id, ME)).r.statusCode, 404);
  assert.equal((await runGuard(courseC.guard({ via: "lesson" }), l1._id, ME)).ok, true);
  assert.equal((await runGuard(courseC.guard({ via: "lesson" }), l2._id, ME)).r.statusCode, 404);
  assert.equal((await runGuard(courseC.guard(), "nope", ME)).r.statusCode, 404);
});

test("courses: submit needs content, only one open request, withdraw unlocks", async () => {
  reset();
  const c = course(); courses.push(c);
  let r = F.res(); await courseC.submit({ params: { id: c._id }, user: { id: ME } }, r);
  assert.equal(r.statusCode, 422);
  lessons.push(new Lesson({ course: c._id, module: "m".repeat(24) }));
  r = F.res(); await courseC.submit({ params: { id: c._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 201);
  r = F.res(); await courseC.submit({ params: { id: c._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 409);
  assert.equal((await runGuard(courseC.guard(), c._id, ME)).r.statusCode, 409);
  r = F.res(); await courseC.withdraw({ params: { id: c._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 200);
  assert.equal((await runGuard(courseC.guard(), c._id, ME)).ok, true);
});

test("course create/update strip featured and status before the library code runs", async () => {
  reset();
  const seen = [];
  const lib = require("../controllers/adminLibraryController");
  lib.createCourse = (req, res) => { seen.push({ ...req.body }); return res.status(201).json({}); };
  lib.updateCourse = (req, res) => { seen.push({ ...req.body }); return res.json({}); };
  await courseC.create({ body: { title: "T", featured: true }, user: { id: ME } }, F.res());
  await courseC.update({ body: { title: "T", featured: true, status: "published" }, params: { id: "x" }, user: { id: ME } }, F.res());
  assert.ok(seen.every((b) => !("featured" in b) && !("status" in b)));
});

// ---------- teacher exams ----------
test("exams: only your own draft; no questions means not ready; one open request; published exams are admin-only", async () => {
  reset();
  const mine = new Exam({ title: "Mock", createdBy: ME, status: "draft", questions: [] }), theirs = new Exam({ title: "X", createdBy: "2".repeat(24), status: "draft", questions: [] }), pub = new Exam({ title: "P", createdBy: ME, status: "published", questions: [{}] });
  exams.push(mine, theirs, pub);
  assert.equal((await runGuard(examC.owned(), mine._id, ME)).ok, true);
  assert.equal((await runGuard(examC.owned(), theirs._id, ME)).r.statusCode, 404);
  assert.equal((await runGuard(examC.owned(), pub._id, ME)).r.statusCode, 409);
  assert.equal((await runGuard(examC.owned({ readOnly: true }), pub._id, ME)).ok, true);
  let r = F.res(); await examC.submit({ params: { id: mine._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 422);
  mine.questions.push({ text: "q" });
  r = F.res(); await examC.submit({ params: { id: mine._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 201);
  r = F.res(); await examC.submit({ params: { id: mine._id }, user: { id: ME } }, r); assert.equal(r.statusCode, 409);
  assert.equal((await runGuard(examC.owned(), mine._id, ME)).r.statusCode, 409); // locked while waiting
  r = F.res(); await examC.mine({ user: { id: ME } }, r);
  assert.equal(r.body.exams.find((e) => e.title === "Mock").review.status, "pending");
});

// ---------- admin review of courses and exams ----------
test("admin review: publish runs the real publish code and passes its refusal through; return needs a note; everything audited and the teacher told", async () => {
  reset();
  const t = teacher(); users.push(t);
  const sub = new TeacherSubmission({ kind: "course", refId: "c".repeat(24), teacherId: t._id, title: "Acids", status: "pending" }); subs.push(sub);
  const dec = async (id, action, note) => { const r = F.res(); await admin.submissionDecision({ params: { id }, body: { action, note }, user: ADMIN }, r); return r; };
  assert.equal((await dec(sub._id, "return", "")).statusCode, 400);
  libCalls.fail = true;
  let r = await dec(sub._id, "publish");
  assert.equal(r.statusCode, 422); assert.equal(sub.status, "pending");              // the course code refused: stays pending
  libCalls.fail = false;
  r = await dec(sub._id, "publish");
  assert.equal(r.statusCode, 200); assert.equal(sub.status, "published"); assert.deepEqual(libCalls.slice(-1), ["c".repeat(24)]);
  assert.equal((await dec(sub._id, "publish")).statusCode, 404);                      // no longer waiting
  const ex = new TeacherSubmission({ kind: "exam", refId: "e".repeat(24), teacherId: t._id, title: "Mock", status: "pending" }); subs.push(ex);
  assert.equal((await dec(ex._id, "publish")).statusCode, 200); assert.deepEqual(examCalls, ["e".repeat(24)]);
  const ex2 = new TeacherSubmission({ kind: "exam", refId: "d".repeat(24), teacherId: t._id, title: "M2", status: "pending" }); subs.push(ex2);
  assert.equal((await dec(ex2._id, "return", "Fix Q3")).statusCode, 200); assert.equal(ex2.note, "Fix Q3");
  assert.equal(base.notify.notifyTeacherSubmission.calls.length, 3);
  assert.deepEqual(base.audit.calls.map((c) => c[1].event), ["teacher.course.publish", "teacher.exam.publish", "teacher.exam.return"]);
  r = F.res(); await admin.submissions({ query: {} }, r); assert.equal(r.body.submissions.length, 0);
});

test("dashboard overview counts only the teacher's own work and visible students", async () => {
  reset();
  const t = teacher(), a = student("Amy"); users.push(t, a);
  enrols.push(enrol(a, ["Chemistry"]));
  groups.push(new TeacherGroup({ teacherId: t._id, subject: "Chemistry", subjectKey: "chemistry", programmeKey: "", status: "active" }));
  courses.push(course({ createdBy: t._id }), course({ createdBy: "9".repeat(24) }));
  exams.push(new Exam({ createdBy: t._id, status: "published" }), new Exam({ createdBy: t._id, status: "draft" }));
  mats.push(new Material({ createdBy: t._id, status: "draft", review: { requestedAt: new Date() } }), new Material({ createdBy: t._id, status: "published" }));
  const r = F.res(); await overview.get({ user: { id: t._id } }, r);
  assert.equal(r.body.students, 1); assert.equal(r.body.courses.total, 1); assert.equal(r.body.exams.total, 2); assert.equal(r.body.exams.published, 1);
  assert.equal(r.body.materials.underReview, 1); assert.equal(r.body.materials.published, 1);
});
