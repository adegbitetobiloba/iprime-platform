// Catches misplaced files and checks the security-critical wiring of the verification, check-in, payment, deletion and messaging routes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const EXPECTED = [
  "models/StudentAccess.js", "models/Attendance.js", "models/SiteSetting.js", "models/MessageFile.js",
  "utils/accessRules.js", "utils/access.js", "utils/accessNotify.js", "utils/messageHub.js", "utils/messageNotify.js", "utils/messageFiles.js",
  "controllers/adminPeopleController.js", "controllers/adminCheckinController.js", "controllers/adminSettingsController.js", "controllers/studentAccessController.js", "controllers/messageFileController.js",
  "routes/adminPeopleRoutes.js", "routes/adminCheckinRoutes.js", "routes/adminSettingsRoutes.js", "validations/accessValidation.js",
  "controllers/messageController.js", "controllers/adminMessageController.js", "routes/messageRoutes.js", "routes/adminMessageRoutes.js", "models/Conversation.js", "models/Message.js", "validations/messageValidation.js",
  "controllers/enrolmentController.js", "routes/enrolmentRoutes.js", "models/Enrolment.js", "validations/enrolmentValidation.js",
];
for (const f of EXPECTED) test(`${f} is in the right folder`, () => assert.ok(fs.existsSync(path.join(root, f)), `${f} is missing from backend/`));

test("every relative require inside these files resolves", () => {
  for (const f of EXPECTED) {
    for (const m of read(f).matchAll(/require\("(\.[^"]+)"\)/g)) {
      const target = path.resolve(path.dirname(path.join(root, f)), m[1]);
      assert.ok(fs.existsSync(target) || fs.existsSync(`${target}.js`), `${f} requires ${m[1]} which does not exist`);
    }
  }
});

test("the admin-only routes are mounted only after the admin guard", { skip: !fs.existsSync(path.join(root, "routes/adminRoutes.js")) && "adminRoutes.js not present" }, () => {
  const src = read("routes/adminRoutes.js");
  const guard = src.indexOf('requireRole("admin")');
  assert.ok(guard > -1, "adminRoutes.js must use requireRole(\"admin\")");
  for (const mount of ['"/people"', '"/checkin"', '"/settings"', '"/messages"', '"/enrolments"']) {
    const at = src.indexOf(`router.use(${mount}`);
    assert.ok(at > -1, `adminRoutes.js does not mount ${mount} yet`);
    assert.ok(at > guard, `${mount} must be mounted AFTER router.use(protect, requireRole("admin"))`);
  }
});

test("student routes are locked to the student role first, and the enrolment info route sits above /:id", () => {
  for (const f of ["routes/messageRoutes.js", "routes/enrolmentRoutes.js"]) {
    const src = read(f);
    const guard = src.indexOf('requireRole("student")');
    assert.ok(guard > -1, `${f} must use requireRole("student")`);
    for (const h of ["router.get(", "router.post(", "router.patch("]) { const at = src.indexOf(h); if (at > -1) assert.ok(at > guard, `${f}: a route is declared before the role guard`); }
  }
  const e = read("routes/enrolmentRoutes.js");
  assert.ok(e.indexOf('"/info"') > -1 && e.indexOf('"/info"') < e.indexOf('"/:id"'), '"/info" must be declared above "/:id" or it would be read as an application id');
});

test("no student route can address another person", () => {
  for (const f of ["routes/messageRoutes.js", "routes/enrolmentRoutes.js"]) assert.ok(!/:studentId|:userId|:recipient/.test(read(f)), `${f} must not take another user's id`);
});

test("the student enrolment form is gated on the office's decision in every write path", () => {
  const src = read("controllers/enrolmentController.js");
  for (const fn of ["exports.create", "exports.save", "exports.submit"]) {
    const body = src.slice(src.indexOf(fn));
    const stop = body.indexOf("\nexports.", 10);
    assert.ok((stop > -1 ? body.slice(0, stop) : body).includes("canOpenEnrolmentForm"), `${fn} must check canOpenEnrolmentForm`);
  }
});

test("account deletion refuses administrators and the caller's own account, and the audit entry holds no personal fields", () => {
  const src = read("controllers/adminPeopleController.js");
  assert.ok(/role === "admin"/.test(src) && /cannot be deleted here/.test(src), "deletion must refuse administrator accounts");
  assert.ok(/req\.user\.id/.test(src.slice(src.indexOf("exports.remove"))), "deletion must compare against the caller");
  const audit = src.slice(src.indexOf('event: "account.deleted"'), src.indexOf('event: "account.deleted"') + 200);
  for (const field of ["email", "firstName", "lastName", "phone", "studentId"]) assert.ok(!audit.includes(field), `the deletion audit entry must not include ${field}`);
});
