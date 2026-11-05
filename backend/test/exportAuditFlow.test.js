// Verifies the order that matters: the audit entry is written BEFORE the file is sent, and a failed audit blocks the export.
// The controller's database models and audit helper are replaced with fakes (no database needed).
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

function loadController({ auditImpl }) {
  const calls = [];
  const fake = {
    mongoose: { isValidObjectId: (v) => /^[a-f0-9]{24}$/i.test(String(v)) },
    "../models/Exam": { findById: () => ({ select: () => ({ lean: async () => ({ _id: "e1", title: "Mock 3", subject: "Maths" }) }) }) },
    "../models/Attempt": { find: () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [{ _id: "a1", userId: "u1", status: "submitted", submittedAt: new Date(), percentage: 60, score: 6, totalMarks: 10, correct: 6, incorrect: 4, unanswered: 0 }] }) },
    "../models/User": { find: () => ({ select: () => ({ lean: async () => [{ _id: "u1", firstName: "Ada", lastName: "Obi", studentId: "P1" }] }) }) },
    "../models/AuditLog": {},
    "../utils/audit": { audit: async (req, entry) => { calls.push(["audit", entry]); return auditImpl(entry); } },
  };
  const orig = Module._load;
  Module._load = function (request, parent, ...rest) {
    if (fake[request] && parent && /adminAnalyticsController\.js$/.test(parent.filename)) return fake[request];
    return orig.call(this, request, parent, ...rest);
  };
  const path = require.resolve("../controllers/adminAnalyticsController");
  delete require.cache[path];
  let c;
  try { c = require(path); } finally { Module._load = orig; }
  return { c, calls };
}

const mkRes = (calls) => ({ headers: null, body: null, statusCode: 200, set(h) { this.headers = h; calls.push(["set"]); return this; }, send(b) { this.body = b; calls.push(["send"]); return this; }, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; calls.push(["json", this.statusCode]); return this; } });

test("the audit entry is written before the file is sent", async () => {
  const { c, calls } = loadController({ auditImpl: async () => ({}) });
  const res = mkRes(calls);
  await c.examCsv({ params: { examId: "64b7f0f0f0f0f0f0f0f0f0f0" }, user: { id: "admin1", role: "admin" } }, res);
  const order = calls.map((x) => x[0]);
  assert.ok(order.indexOf("audit") < order.indexOf("send"), order.join(","));
  assert.equal(calls.find((x) => x[0] === "audit")[1].meta.rowCount, 1);
  assert.match(res.body, /Ada Obi/); assert.match(res.headers["Content-Disposition"], /attachment/);
});

test("if the audit entry cannot be written, no file is sent", async () => {
  const { c, calls } = loadController({ auditImpl: async () => { throw new Error("db down"); } });
  const res = mkRes(calls);
  const origErr = console.error; console.error = () => {};
  try { await c.examCsv({ params: { examId: "64b7f0f0f0f0f0f0f0f0f0f0" }, user: { id: "admin1", role: "admin" } }, res); } finally { console.error = origErr; }
  assert.equal(calls.some((x) => x[0] === "send"), false);
  assert.equal(res.statusCode, 500); assert.ok(!String(res.body && res.body.error || "").includes("db down"));
});
