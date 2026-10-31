// Guards the admin menu: every top-level admin page registered in App.jsx must have a link in AdminLayout.jsx.
// (An earlier layout change dropped the Question bank and Import links without anyone noticing.)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "frontend", "src");
const appFile = path.join(src, "App.jsx");
const layoutFile = path.join(src, "pages", "admin", "AdminLayout.jsx");
const present = fs.existsSync(appFile) && fs.existsSync(layoutFile);

test("every top-level admin route has a menu link", { skip: !present && "frontend sources not found" }, () => {
  const app = fs.readFileSync(appFile, "utf8");
  const layout = fs.readFileSync(layoutFile, "utf8");
  const group = app.slice(app.indexOf('<Route path="/admin"'), app.indexOf('<Route path="*"'));
  const routes = [...group.matchAll(/<Route path="([a-z-]+)" element=\{<Admin/g)].map((m) => m[1]); // top level only: no ":" and no "/"
  assert.ok(routes.length >= 5, "could not read the admin routes from App.jsx");
  const missing = routes.filter((r) => !layout.includes(`"/admin/${r}"`));
  assert.deepEqual(missing, [], `these admin pages have no menu link: ${missing.join(", ")}`);
});

test("the menu does not link to an admin page that has no route", { skip: !present && "frontend sources not found" }, () => {
  const app = fs.readFileSync(appFile, "utf8");
  const layout = fs.readFileSync(layoutFile, "utf8");
  const links = [...layout.matchAll(/to: "\/admin\/([a-z-]+)"/g)].map((m) => m[1]);
  const missing = links.filter((l) => !app.includes(`path="${l}"`));
  assert.deepEqual(missing, [], `the menu links to pages with no route in App.jsx: ${missing.join(", ")}`);
});
