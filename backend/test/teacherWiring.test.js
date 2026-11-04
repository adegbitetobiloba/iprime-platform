const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("the teacher router is mounted BEFORE the student/admin-only /api CBT router", () => {
  const app = read("app.js");
  const teacher = app.indexOf('app.use("/api/teacher"');
  const cbt = app.indexOf('app.use("/api", cbtRoutes)');
  assert.ok(teacher > 0 && cbt > 0 && teacher < cbt);
});

test("everything below the teacher sign-in routes sits behind protect + requireTeacher", () => {
  const src = read("routes/teacherRoutes.js");
  const gate = src.indexOf("router.use(protect, requireTeacher)");
  assert.ok(gate > 0);
  for (const open of ['"/auth/apply"', '"/auth/verify-otp"', '"/auth/resend-otp"', '"/auth/login"']) assert.ok(src.indexOf(open) < gate, open);
  for (const guarded of ['"/me"', '"/profile"', '"/students"', '"/library"']) assert.ok(src.indexOf(guarded) > gate, guarded);
});

test("admin teacher routes live inside the admin-only router", () => {
  const src = read("routes/adminRoutes.js");
  assert.ok(src.indexOf('router.use(protect, requireRole("admin"))') < src.indexOf('"/teachers"'));
  const r = read("routes/adminTeacherRoutes.js");
  assert.ok(r.indexOf('"/library/review"') < r.indexOf('router.get("/:id"')); // "library" is never read as a teacher id
});

test("the public login route runs the teacher blocker before login, and public signup cannot create teachers", () => {
  const src = read("routes/authRoutes.js");
  assert.match(src, /rejectTeacherOnPublicLogin, login/);
  assert.doesNotMatch(read("routes/teacherRoutes.js"), /schemas\.register/);
});

test("teacher library routes: no publish/status/feature endpoint, and every write is guarded by the ownership check", () => {
  const src = read("routes/teacherLibraryRoutes.js");
  const code = src.split("\n").filter((l) => l.startsWith("router.")).join("\n"); // route lines only, not comments
  assert.doesNotMatch(code, /\/status|publish|featured/);
  const writes = src.split("\n").filter((l) => /^router\.(patch|put|delete)\(/.test(l));
  assert.ok(writes.length >= 4);
  for (const l of writes) assert.match(l, /c\.owned\(/, l);
});
