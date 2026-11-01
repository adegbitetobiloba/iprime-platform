// Run with: node --test frontend/tests/scrollspy.test.mjs   (no dependencies; imports only the pure helper)
import test from "node:test";
import assert from "node:assert/strict";
import { pickActive } from "../src/useScrollSpy.js";

const ids = ["who", "purpose", "values"];
test("picks the first visible section in page order", () => assert.equal(pickActive(ids, { purpose: 0.4, values: 0.9 }, "who"), "purpose"));
test("keeps the previous section when nothing is visible", () => assert.equal(pickActive(ids, {}, "purpose"), "purpose"));
test("falls back to the first id", () => assert.equal(pickActive(ids, {}, undefined), "who"));
