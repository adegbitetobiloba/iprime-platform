const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_test_secret_test_secret_123456";

const app = require("../app");
const { schemas, SELF_SIGNUP_ROLES } = require("../validations/authValidation");

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("GET /health returns ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
});

test("unknown routes return 404 JSON", async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});

test("protected route rejects missing token", async () => {
  const res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 401);
});

test("register validation rejects bad input", async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  assert.equal(res.status, 400);
});

test("self-signup cannot choose admin or teacher", () => {
  assert.deepEqual(SELF_SIGNUP_ROLES, ["student", "parent"]);
  const base = {
    firstName: "A", lastName: "B", email: "a@b.com", phone: "08012345678", state: "Lagos", password: "longenough1",
  };
  assert.ok(schemas.register.validate({ ...base, role: "student" }).error === undefined);
  assert.ok(schemas.register.validate({ ...base, role: "admin" }).error);
  assert.ok(schemas.register.validate({ ...base, role: "teacher" }).error);
});
