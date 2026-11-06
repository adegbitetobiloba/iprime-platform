const test = require("node:test");
const assert = require("node:assert");
const { safeLogPath } = require("../utils/logRedact");

test("share link tokens are hidden", () => {
  assert.strictEqual(safeLogPath("/api/share/AbC123xyz"), "/api/share/:token");
  assert.strictEqual(safeLogPath("/api/share/AbC123xyz/enter"), "/api/share/:token/enter");
});
test("other share routes are kept", () => {
  assert.strictEqual(safeLogPath("/api/share/seb-check"), "/api/share/seb-check");
  assert.strictEqual(safeLogPath("/api/share/exams/6aeced/status"), "/api/share/exams/6aeced/status");
});
test("query strings are dropped", () => {
  assert.strictEqual(safeLogPath("/api/admin/students?search=ada&page=1"), "/api/admin/students");
});
test("empty input is safe", () => {
  assert.strictEqual(safeLogPath(undefined), "");
});
