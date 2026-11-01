// In-memory stand-ins for the database, used by the controller tests (no MongoDB needed).
const Module = require("module");
let seq, bankDocs, exams, attemptsFor, users;
const hex = () => String(++seq).padStart(24, "0");

const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : Array.isArray(a) ? a.flatMap((x) => (x == null ? [] : [x[k]])) : a[k]), o);
function matches(doc, f) {
  return Object.entries(f).every(([k, v]) => {
    if (k === "$or") return v.some((c) => matches(doc, c));
    const val = get(doc, k);
    if (v instanceof RegExp) return v.test(String(val ?? ""));
    if (v && typeof v === "object" && "$in" in v) { const one = Array.isArray(val) ? val[0] : val; return v.$in.map(String).includes(String(one === undefined ? null : one)); } // like MongoDB: null matches a missing field
    if (v && typeof v === "object" && "$ne" in v) return String(val ?? null) !== String(v.$ne);
    return Array.isArray(val) ? val.map(String).includes(String(v)) : String(val) === String(v);
  });
}
class Query { constructor(rows) { this.rows = rows; } sort() { return this; } skip(n) { this.rows = this.rows.slice(n); return this; } limit(n) { this.rows = this.rows.slice(0, n); return this; } lean() { return Promise.resolve(this.rows.map((r) => (r.toObject ? r.toObject() : r))); } then(a, b) { return Promise.resolve(this.rows).then(a, b); } }
class Doc {
  constructor(f) { Object.assign(this, JSON.parse(JSON.stringify(f))); if (f.solution) this.solution = f.solution; this._id = f._id || hex(); this.status = this.status || "active"; this.version = this.version || 1; this.updatedAt = new Date(); }
  set(o) { Object.assign(this, o); }
  async save() { return this; }
  toObject() { const { set, save, toObject, ...rest } = this; return { ...rest }; }
}
const FakeBank = {
  find: (f = {}) => new Query(bankDocs.filter((d) => matches(d, f))),
  findById: async (id) => bankDocs.find((d) => d._id === String(id)) || null,
  countDocuments: async (f = {}) => bankDocs.filter((d) => matches(d, f)).length,
  async insertMany(docs) {
    const out = [];
    for (const d of docs) { if (bankDocs.some((x) => x.externalKey === d.externalKey)) { const e = new Error("dup"); e.writeErrors = [{ code: 11000 }]; e.insertedDocs = out; throw e; } const n = new Doc(d); bankDocs.push(n); out.push(n); }
    return out;
  },
  async updateOne({ _id }, upd) { const d = bankDocs.find((x) => x._id === String(_id)); Object.assign(d, upd.$set); d.version = (d.version || 1) + (upd.$inc?.version || 0); },
  aggregate: async () => [],
};
class Q extends Doc { set(o) { Object.assign(this, o); } }
const FakeExam = {
  async findById(id) { return exams.find((e) => e._id === String(id)) || null; },
  find: (f) => new Query(exams.filter((e) => e.questions.some((q) => String(q.bankId) === String(f["questions.bankId"])))),
  countDocuments: async (f) => exams.filter((e) => e.questions.some((q) => String(q.bankId) === String(f["questions.bankId"]))).length,
};
const FakeAttempt = { exists: async ({ examId }) => (attemptsFor.has(String(examId)) ? { _id: "x" } : null) };
const FakeUser = { findById: (id) => ({ select: async () => users[id] || null }) };

const stubs = {
  mongoose: { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) },
  "../models/BankQuestion": FakeBank, "../models/Exam": FakeExam, "../models/Attempt": FakeAttempt, "../models/User": FakeUser,
};
const orig = Module._load;
Module._load = function (request, parent, ...rest) {
  if (parent && /(controllers|middleware)[\\/](bankController|roleMiddleware)\.js$/.test(parent.filename) && stubs[request]) return stubs[request];
  return orig.call(this, request, parent, ...rest);
};

function reset() { seq = 0; bankDocs = []; exams = []; attemptsFor = new Set(); users = { admin1: { role: "admin", isVerified: true }, stu1: { role: "student", isVerified: true } }; }
const newExam = (over = {}) => { const e = { _id: hex(), title: "Exam", status: "draft", questions: [], async save() { return this; }, ...over }; exams.push(e); return e; };
reset();
module.exports = { reset, newExam, get bankDocs() { return bankDocs; }, get exams() { return exams; }, attemptsFor: () => attemptsFor };
