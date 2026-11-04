// Tiny in-memory stand-ins for the database models and email/OTP helpers, in the style of the existing tests (Module._load stubs).
// They let the REAL controllers and middleware run without MongoDB. Anything involving real MongoDB behaviour (indexes, aggregation) is NOT covered here.
const Module = require("module");
const path = require("path");

let seq = 0;
const newId = () => (++seq).toString(16).padStart(24, "0");
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);

function matches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === "$or") return v.some((sub) => matches(doc, sub));
    const dv = get(doc, k);
    if (v instanceof RegExp) return v.test(String(dv));
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("$in" in v) return v.$in.map(String).includes(String(dv));
      if ("$exists" in v) return (dv !== undefined) === v.$exists;
      return false;
    }
    if (v === undefined) return dv === undefined;
    return String(dv) === String(v);
  });
}
const mk = (value) => { const p = Promise.resolve(value); for (const m of ["select", "sort", "lean", "populate", "limit"]) p[m] = () => p; return p; };

function makeModel(rows = []) {
  class Doc {
    constructor(d) { Object.assign(this, d); if (!this._id) this._id = newId(); }
    async save() { if (!rows.includes(this)) rows.push(this); return this; }
    toObject() { const o = {}; for (const [k, v] of Object.entries(this)) if (typeof v !== "function") o[k] = v; return o; }
  }
  Doc.rows = rows;
  Doc.find = (q = {}) => mk(rows.filter((d) => matches(d, q)));
  Doc.findOne = (q = {}) => mk(rows.find((d) => matches(d, q)) || null);
  Doc.findById = (id) => mk(rows.find((d) => String(d._id) === String(id)) || null);
  Doc.create = async (d) => { const x = new Doc(d); rows.push(x); return x; };
  Doc.countDocuments = async (q = {}) => rows.filter((d) => matches(d, q)).length;
  Doc.aggregate = async () => [];
  Doc.findByIdAndUpdate = (id, upd) => {
    const d = rows.find((x) => String(x._id) === String(id));
    if (d && upd.$set) for (const [k, v] of Object.entries(upd.$set)) {
      const parts = k.split("."); let o = d;
      parts.slice(0, -1).forEach((p) => { o[p] = o[p] || {}; o = o[p]; });
      o[parts.at(-1)] = v;
    }
    Doc.lastUpdate = upd;
    return mk(d || null);
  };
  return Doc;
}

function res() {
  return { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

// Replaces modules by the tail of the path they are required with. Call BEFORE requiring the code under test.
function install(stubs) {
  const orig = Module._load;
  Module._load = function (request, parent, ...rest) {
    for (const [tail, stub] of Object.entries(stubs)) {
      if (request === tail || request.endsWith("/" + tail)) return stub;
    }
    return orig.call(this, request, parent, ...rest);
  };
  return () => { Module._load = orig; };
}

const calls = () => { const c = []; const fn = async (...a) => { c.push(a); }; fn.calls = c; return fn; };

const baseStubs = ({ User, TeacherAssignment, Material } = {}) => {
  const notify = {};
  for (const n of ["notifyAdminsNewTeacher", "notifyTeacherApproved", "notifyTeacherRejected", "notifyTeacherSuspended", "notifyTeacherMaterial"]) notify[n] = calls();
  const auditFn = calls();
  const otp = { issueOtp: calls(), consumeOtp: async (e, c) => c === "123456", msSinceLastOtp: async () => null, COOLDOWN_MS: 60000 };
  return {
    notify, audit: auditFn, otp,
    stubs: {
      "models/User": User, "models/TeacherAssignment": TeacherAssignment, "models/LibraryMaterial": Material,
      "models/Subject": makeModel([]),
      bcryptjs: { hashSync: (p) => `hash:${p}`, hash: async (p) => `hash:${p}`, compare: async (p, h) => h === `hash:${p}` },
      "utils/otpService": otp, "utils/teacherNotify": notify,
      "utils/audit": { audit: auditFn },
      "utils/session": { issueSession: (u) => `token-for-${u._id}` },
      "utils/publicUser": (u) => { const { password, ...rest } = u.toObject(); return rest; },
      "utils/libraryStore": { servePdf: () => {} },
      mongoose: { isValidObjectId: (s) => /^[0-9a-f]{24}$/.test(String(s)) },
    },
  };
}
module.exports = { makeModel, res, install, calls, baseStubs, newId, mk, root: path.join(__dirname, "..", "..") };
