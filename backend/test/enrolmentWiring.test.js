// Catches the "files in the wrong folder" mistake: app.js and adminRoutes.js require these exact paths.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const EXPECTED = [
  "models/Enrolment.js", "models/AuditLog.js",
  "controllers/enrolmentController.js", "controllers/adminEnrolmentController.js",
  "routes/enrolmentRoutes.js", "routes/adminEnrolmentRoutes.js",
  "utils/audit.js", "utils/enrolmentRules.js", "utils/enrolmentSubmit.js",
  "validations/enrolmentValidation.js",
];
for (const f of EXPECTED) test(`${f} is in the right folder`, () => assert.ok(fs.existsSync(path.join(root, f)), `${f} is missing from backend/`));

test("every relative require inside the enrolment files resolves", () => {
  for (const f of EXPECTED) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of src.matchAll(/require\("(\.[^"]+)"\)/g)) {
      const target = path.resolve(path.dirname(path.join(root, f)), m[1]);
      assert.ok(fs.existsSync(target) || fs.existsSync(target + ".js"), `${f} requires ${m[1]} which does not exist`);
    }
  }
});
