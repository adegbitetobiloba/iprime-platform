// Catches misplaced files, and checks the two security-critical wiring rules by reading the route files.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const EXPECTED = ["models/Conversation.js", "models/Message.js", "controllers/messageController.js", "controllers/adminMessageController.js", "routes/messageRoutes.js", "routes/adminMessageRoutes.js", "validations/messageValidation.js"];
for (const f of EXPECTED) test(`${f} is in the right folder`, () => assert.ok(fs.existsSync(path.join(root, f)), `${f} is missing from backend/`));

test("every relative require inside the messaging files resolves", () => {
  for (const f of EXPECTED) {
    for (const m of read(f).matchAll(/require\("(\.[^"]+)"\)/g)) {
      const target = path.resolve(path.dirname(path.join(root, f)), m[1]);
      assert.ok(fs.existsSync(target) || fs.existsSync(`${target}.js`), `${f} requires ${m[1]} which does not exist`);
    }
  }
});

test("student routes are locked to the student role before any handler", () => {
  const src = read("routes/messageRoutes.js");
  const guard = src.indexOf('requireRole("student")');
  assert.ok(guard > -1, "student routes must use requireRole(\"student\")");
  for (const handler of ["router.get(", "router.post("]) assert.ok(src.indexOf(handler) > guard, "a route is declared before the role guard");
});

test("no student route takes a recipient or a student id from the URL", () => {
  const src = read("routes/messageRoutes.js");
  assert.ok(!/:studentId|:userId|:recipient/.test(src), "student routes must not address another user");
});

test("admin message routes are mounted only after the admin guard", { skip: !fs.existsSync(path.join(root, "routes/adminRoutes.js")) && "adminRoutes.js not present" }, () => {
  const src = read("routes/adminRoutes.js");
  const guard = src.indexOf('requireRole("admin")');
  const mount = src.indexOf('"/messages"');
  assert.ok(mount > -1, "adminRoutes.js does not mount /messages yet");
  assert.ok(guard > -1 && mount > guard, "/messages must be mounted AFTER router.use(protect, requireRole(\"admin\"))");
});
