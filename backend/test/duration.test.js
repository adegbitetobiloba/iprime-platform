const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deadlineFor } = require("../utils/cbt");
test("the server deadline is exactly start + the stored minutes, for every common duration", () => {
  const start = new Date("2026-11-02T08:00:00.000Z");
  for (const m of [15, 30, 45, 60, 90, 120, 150, 180, 240, 360, 1, 37]) assert.equal(deadlineFor(start, m).getTime() - start.getTime(), m * 60000);
});
