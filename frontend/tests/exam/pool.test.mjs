import { test } from "node:test";
import assert from "node:assert/strict";
import { describe, expectedOverlap, fullyDifferentStudents } from "../../src/lib/exam/pool.js";

test("the maths matches the server", () => {
  assert.equal(Math.round(expectedOverlap(40, 300) * 100) / 100, 5.33);
  assert.equal(fullyDifferentStudents(40, 300), 7); assert.equal(fullyDifferentStudents(10, 1200), 120);
  assert.equal(expectedOverlap(40, 0), 0);
});
test("blank means everyone gets everything", () => {
  assert.match(describe("", 300).text, /all 300 questions/); assert.match(describe(0, 1).text, /all 1 question\./);
});
test("a number bigger than the pool is explained, not an error", () => {
  const d = describe(500, 40); assert.ok(d.ok); assert.match(d.text, /only 40 questions/);
});
test("a normal draw explains how many students get completely different papers", () => {
  const d = describe(40, 300); assert.ok(d.ok); assert.match(d.text, /first 7 students/); assert.match(d.text, /pool of 300/);
});
test("too many per student is refused", () => { assert.equal(describe(501, 900).ok, false); });
