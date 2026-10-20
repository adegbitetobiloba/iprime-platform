const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { initialApproval, isApproved, approvalBlock } = require("../utils/approval");

beforeEach(() => { delete process.env.REQUIRE_STUDENT_APPROVAL; });

test("a new student starts as pending", () => assert.equal(initialApproval("student"), "pending"));
test("parents, alumni, teachers and admins do not need student approval", () => {
  for (const r of ["parent", "alumni", "teacher", "admin"]) assert.equal(initialApproval(r), "approved");
});
test("the owner can switch approval off", () => {
  process.env.REQUIRE_STUDENT_APPROVAL = "false";
  assert.equal(initialApproval("student"), "approved");
});
test("EVERY existing account (no approval value at all) counts as approved, so nobody is locked out", () => {
  assert.equal(isApproved({ email: "old@x.com", role: "student" }), true);
  assert.equal(isApproved({ approval: undefined }), true);
  assert.equal(isApproved({ approval: null }), true);
  assert.equal(approvalBlock({ role: "student" }), null);
});
test("approved accounts pass", () => assert.equal(approvalBlock({ approval: "approved" }), null));
test("pending accounts are told to wait, with a stable code", () => {
  const b = approvalBlock({ approval: "pending" });
  assert.equal(b.code, "PENDING_APPROVAL");
  assert.equal(b.status, "pending");
});
test("rejected accounts get a different, clear message", () => {
  const b = approvalBlock({ approval: "rejected" });
  assert.equal(b.code, "ACCOUNT_REJECTED");
  assert.notEqual(b.error, approvalBlock({ approval: "pending" }).error);
});
test("an unknown value is treated as NOT approved (fail closed)", () => {
  assert.equal(isApproved({ approval: "banana" }), false);
  assert.ok(approvalBlock({ approval: "banana" }));
});
