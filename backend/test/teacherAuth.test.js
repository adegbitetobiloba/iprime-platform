const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./support/teacherFakes");

const users = [];
const User = F.makeModel(users);
const base = F.baseStubs({ User, TeacherAssignment: F.makeModel([]), Material: F.makeModel([]) });
F.install(base.stubs);
const auth = require("../controllers/teacherAuthController");
const requireTeacher = require("../middleware/teacherMiddleware");
const rejectTeacherOnPublicLogin = require("../middleware/rejectTeacherOnPublicLogin");
const approval = require("../utils/approval");

const reset = () => { users.length = 0; base.otp.issueOtp.calls.length = 0; base.notify.notifyAdminsNewTeacher.calls.length = 0; };
const mkUser = (o) => new User({ firstName: "Ada", lastName: "Obi", email: "t@example.com", password: "hash:secret123", role: "teacher", isVerified: true, approval: "approved", ...o });
const applyBody = { email: "t@example.com", password: "secret123", firstName: "Ada", lastName: "Obi", phone: "08012345678", state: "Ogun", subjects: ["Physics"], qualification: "B.Sc Physics", yearsExperience: 3 };

test("approval: suspended is blocked with its own message, and still fails closed", () => {
  assert.equal(approval.approvalBlock({ approval: "suspended" }).code, "ACCOUNT_SUSPENDED");
  assert.equal(approval.isApproved({ approval: "suspended" }), false);
  assert.equal(approval.approvalBlock({ approval: "approved" }), null);
  assert.equal(approval.initialApproval("teacher"), "approved"); // unchanged: the application sets "pending" itself
});

test("apply creates a PENDING, unverified teacher; role/approval in the body are ignored", async () => {
  reset();
  const r = F.res();
  await auth.apply({ body: { ...applyBody, role: "admin", approval: "approved", isVerified: true } }, r);
  assert.equal(r.statusCode, 201);
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "teacher");
  assert.equal(users[0].approval, "pending");
  assert.equal(users[0].isVerified, undefined);
  assert.equal(users[0].password, "hash:secret123");
  assert.equal(base.otp.issueOtp.calls.length, 1);
});

test("apply refuses an existing verified account or any admin, and updates (not duplicates) an unfinished application", async () => {
  reset();
  users.push(mkUser({ role: "student" }));
  let r = F.res(); await auth.apply({ body: applyBody }, r);
  assert.equal(r.statusCode, 400);
  assert.equal(users[0].role, "student"); // untouched

  reset();
  users.push(mkUser({ role: "admin", isVerified: false }));
  r = F.res(); await auth.apply({ body: applyBody }, r);
  assert.equal(r.statusCode, 400);
  assert.equal(users[0].role, "admin");

  reset();
  users.push(mkUser({ isVerified: false, approval: "pending" }));
  r = F.res(); await auth.apply({ body: { ...applyBody, firstName: "Ada2" } }, r);
  assert.equal(r.statusCode, 201);
  assert.equal(users.length, 1);
  assert.equal(users[0].firstName, "Ada2");
});

test("verify-otp verifies the email, alerts admins once, and does NOT approve", async () => {
  reset();
  users.push(mkUser({ isVerified: false, approval: "pending" }));
  let r = F.res(); await auth.verifyOtp({ body: { email: "t@example.com", otp: "000000" } }, r);
  assert.equal(r.statusCode, 400);
  r = F.res(); await auth.verifyOtp({ body: { email: "t@example.com", otp: "123456" } }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(users[0].isVerified, true);
  assert.equal(users[0].approval, "pending");
  assert.equal(base.notify.notifyAdminsNewTeacher.calls.length, 1);
  r = F.res(); await auth.verifyOtp({ body: { email: "t@example.com", otp: "123456" } }, r);
  assert.equal(base.notify.notifyAdminsNewTeacher.calls.length, 1); // not alerted twice
});

test("verify-otp does not work for a non-teacher account", async () => {
  reset();
  users.push(mkUser({ role: "student", isVerified: false }));
  const r = F.res(); await auth.verifyOtp({ body: { email: "t@example.com", otp: "123456" } }, r);
  assert.equal(r.statusCode, 400);
  assert.equal(users[0].isVerified, false);
});

test("teacher login: only an approved, verified teacher gets a token", async () => {
  const cases = [
    [{ approval: "pending" }, 403, "PENDING_APPROVAL"],
    [{ approval: "rejected" }, 403, "ACCOUNT_REJECTED"],
    [{ approval: "suspended" }, 403, "ACCOUNT_SUSPENDED"],
    [{ approval: undefined }, 403, "PENDING_APPROVAL"], // old teacher account with no approval value
    [{ isVerified: false }, 403, "NOT_VERIFIED"],
  ];
  for (const [o, status, code] of cases) {
    reset(); users.push(mkUser(o));
    const r = F.res(); await auth.login({ body: { email: "t@example.com", password: "secret123" } }, r);
    assert.equal(r.statusCode, status, JSON.stringify(o));
    assert.equal(r.body.code, code);
    assert.equal(r.body.token, undefined);
  }
  reset(); users.push(mkUser());
  let r = F.res(); await auth.login({ body: { email: "t@example.com", password: "secret123" } }, r);
  assert.equal(r.statusCode, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.user.password, undefined);
  r = F.res(); await auth.login({ body: { email: "t@example.com", password: "wrong" } }, r);
  assert.equal(r.statusCode, 400);
});

test("teacher login answers a student, an admin and an unknown email exactly like a wrong password", async () => {
  for (const role of ["student", "admin", "parent"]) {
    reset(); users.push(mkUser({ role }));
    const r = F.res(); await auth.login({ body: { email: "t@example.com", password: "secret123" } }, r);
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.error, "Invalid email or password");
    assert.equal(r.body.token, undefined);
  }
  reset();
  const r = F.res(); await auth.login({ body: { email: "nobody@example.com", password: "x" } }, r);
  assert.equal(r.body.error, "Invalid email or password");
});

test("public login form: a teacher's email is answered as a wrong password; students pass through", async () => {
  reset(); users.push(mkUser());
  let r = F.res(), nextCalled = false;
  await rejectTeacherOnPublicLogin({ body: { email: "t@example.com", password: "secret123" } }, r, () => { nextCalled = true; });
  assert.equal(r.statusCode, 400);
  assert.equal(r.body.error, "Invalid email or password");
  assert.equal(nextCalled, false);

  reset(); users.push(mkUser({ role: "student" }));
  r = F.res(); nextCalled = false;
  await rejectTeacherOnPublicLogin({ body: { email: "t@example.com", password: "secret123" } }, r, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("requireTeacher: only an approved, verified teacher passes, and it reads the database every time", async () => {
  const run = async (o) => {
    reset(); const u = mkUser(o); users.push(u);
    const r = F.res(); let ok = false;
    await requireTeacher({ user: { id: u._id, role: "teacher" } }, r, () => { ok = true; });
    return { ok, r };
  };
  assert.equal((await run({})).ok, true);
  for (const o of [{ approval: "pending" }, { approval: "rejected" }, { approval: "suspended" }, { approval: undefined }, { isVerified: false }, { role: "student" }, { role: "admin" }, { role: "parent" }]) {
    const { ok, r } = await run(o);
    assert.equal(ok, false, JSON.stringify(o));
    assert.equal(r.statusCode, 403);
  }
  // Suspending an already signed-in teacher locks them out on the very next request.
  reset(); const t = mkUser(); users.push(t);
  let ok = false; await requireTeacher({ user: { id: t._id } }, F.res(), () => { ok = true; });
  assert.equal(ok, true);
  t.approval = "suspended"; ok = false; const r2 = F.res();
  await requireTeacher({ user: { id: t._id } }, r2, () => { ok = true; });
  assert.equal(ok, false); assert.equal(r2.statusCode, 403);
});

test("profile update changes only the allowed fields", async () => {
  reset(); const t = mkUser(); users.push(t);
  const r = F.res();
  await auth.updateProfile({ user: { id: t._id }, body: { phone: "0801", bio: "Hello", role: "admin", approval: "approved", email: "evil@example.com" } }, r);
  assert.deepEqual(Object.keys(User.lastUpdate.$set).sort(), ["phone", "teacherProfile.bio"]);
  assert.equal(t.role, "teacher");
  assert.equal(t.email, "t@example.com");
});
