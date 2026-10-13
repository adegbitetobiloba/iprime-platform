// Guards against the failure that crashed a deploy: a file the server needs was never uploaded to the repository.
// It checks, without needing the database or any installed packages, that every relative require() in the
// backend points at a file that exists. If one is missing, `npm test` fails and the check on GitHub turns red.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const SOURCE_DIRS = ["config", "controllers", "middleware", "models", "routes", "utils", "validations", "scripts", "test"];

function jsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });
}

const resolves = (from, target) => {
  const base = path.resolve(path.dirname(from), target);
  return [base, `${base}.js`, path.join(base, "index.js")].some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
};

test("every relative require() in the backend points to a file that exists", () => {
  const files = [path.join(root, "app.js"), ...SOURCE_DIRS.flatMap((d) => jsFiles(path.join(root, d)))].filter((f) => fs.existsSync(f));
  const missing = [];
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    for (const m of code.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      if (!resolves(file, m[1])) missing.push(`${path.relative(root, file)} needs ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `Missing files:\n  ${missing.join("\n  ")}`);
});

test("the core files the server starts from are present", () => {
  for (const f of ["app.js", "package.json", "config/db.js", "routes/authRoutes.js", "routes/adminRoutes.js", "routes/cbtRoutes.js", "routes/publicRoutes.js"]) {
    assert.ok(fs.existsSync(path.join(root, f)), `${f} is missing`);
  }
});
