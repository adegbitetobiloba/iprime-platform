// In-memory stand-ins for the share/access collections and a tiny signer, for tests.
const crypto = require("crypto");
const hex = (n) => String(n).padStart(24, "0");

const cmp = (docVal, cond) => {
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !(Array.isArray(cond))) {
    return Object.entries(cond).every(([op, v]) => {
      if (op === "$in") return v.some((x) => String(x) === String(docVal));
      if (op === "$lt") return docVal < v; if (op === "$gt") return docVal > v;
      if (op === "$ne") return String(docVal) !== String(v);
      if (op === "$type") return typeof docVal === "string";
      return true;
    });
  }
  return String(docVal) === String(cond);
};
const matches = (d, f = {}) => Object.entries(f).every(([k, c]) => cmp(d[k], c));
const L = (v) => { const api = { select: () => api, lean: async () => v }; return api; };

function collection(rows, { unique } = {}) {
  let seq = 1000;
  return {
    rows,
    findOne: (f) => L(rows.find((r) => matches(r, f)) || null),
    findById: (id) => L(rows.find((r) => String(r._id) === String(id)) || null),
    find: (f) => L(rows.filter((r) => matches(r, f))),
    countDocuments: async (f) => rows.filter((r) => matches(r, f)).length,
    deleteOne: async (f) => { const i = rows.findIndex((r) => matches(r, f)); if (i >= 0) rows.splice(i, 1); },
    async create(doc) {
      if (unique) { const key = unique(doc); if (key && rows.some((r) => unique(r) === key)) { const e = new Error("dup"); e.code = 11000; throw e; } }
      const row = { _id: hex(++seq + 5000), ...doc }; rows.push(row); return { ...row, toObject: () => row };
    },
    async updateOne(f, u, opts = {}) {
      const row = rows.find((r) => matches(r, f));
      if (!row) {
        if (opts.upsert) { const nr = { _id: hex(++seq + 7000), ...Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v !== "object")), ...(u.$setOnInsert || {}), ...(u.$set || {}), ...(u.$inc || {}) }; rows.push(nr); return { upsertedCount: 1, modifiedCount: 0 }; }
        return { modifiedCount: 0, matchedCount: 0 };
      }
      for (const [k, v] of Object.entries(u.$inc || {})) row[k] = (row[k] || 0) + v;
      for (const [k, v] of Object.entries(u.$set || {})) row[k] = v;
      return { modifiedCount: 1, matchedCount: 1, upsertedCount: 0 };
    },
  };
}

// A minimal HS256 token (the real app uses the jsonwebtoken package).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = {
  sign: (payload, secret, opts) => { const h = b64({ alg: "HS256" }), p = b64({ ...payload, _expiresIn: opts && opts.expiresIn }); return `${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`; },
  decode: (t) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()),
  verify: (t, secret) => { const [h, p, s] = t.split("."); if (crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url") !== s) throw new Error("bad signature"); return jwt.decode(t); },
};

const res = () => ({ statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn({ params: {}, query: {}, body: {}, headers: {}, protocol: "https", originalUrl: "/", get: (h) => (String(h).toLowerCase() === "host" ? "api.example.com" : undefined), ...req }, r); return r; };

module.exports = { hex, collection, jwt, res, call };
