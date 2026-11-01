import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, split, join, label, problem } from "../../src/lib/exam/duration.js";

test("hours and minutes convert both ways without loss", () => {
  for (let m = 1; m <= 360; m++) { const { hours, minutes } = split(m); assert.equal(join(hours, minutes), m); assert.ok(minutes < 60); }
  assert.deepEqual(split(90), { hours: 1, minutes: 30 });
  assert.equal(join("1", "30"), 90); assert.equal(join("", "45"), 45); assert.equal(join("2", ""), 120);
});

test("labels read naturally", () => {
  assert.equal(label(15), "15 minutes"); assert.equal(label(1), "1 minute"); assert.equal(label(60), "1 hour");
  assert.equal(label(90), "1 hour 30 minutes"); assert.equal(label(120), "2 hours"); assert.equal(label(135), "2 hours 15 minutes"); assert.equal(label(0), "");
});

test("every preset is valid and the set matches the brief", () => {
  for (const p of PRESETS) assert.equal(problem(p), null);
  for (const must of [15, 30, 45, 60, 90, 120]) assert.ok(PRESETS.includes(must));
});

test("the limits match the server (1 to 360 whole minutes)", () => {
  assert.equal(problem(1), null); assert.equal(problem(360), null);
  for (const bad of [0, -5, 361, 1000, 2.5, "", null, undefined, NaN]) assert.ok(problem(bad), `should reject ${bad}`);
});
