import { test } from "node:test";
import assert from "node:assert/strict";
import { checkName, checkPassword } from "../src/lib/guestName.js";
test("a name is required and must look like a name", () => {
  for (const good of ["Ada Obi", "Chukwuemeka O'Brien-Smith", "Ọlá Adéyẹmí", "  Ada   Obi  "]) assert.equal(checkName(good).ok, true, good);
  assert.equal(checkName("  Ada   Obi  ").value, "Ada Obi");
  for (const bad of ["", "   ", null, undefined, "A", "12345", "<b>x</b>", "ada@x.com", "x".repeat(61), "Ada 2"]) assert.equal(checkName(bad).ok, false, String(bad));
});
test("password rules match the server", () => {
  assert.equal(checkPassword("abc").ok, false); assert.equal(checkPassword("abcd").ok, true); assert.equal(checkPassword("    ").ok, false); assert.equal(checkPassword("x".repeat(65)).ok, false); assert.equal(checkPassword(undefined).ok, false);
});
