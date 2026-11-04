// In-memory stand-ins for the database models, so controllers can be tested with no database and no network.
// They implement only the query operators the controllers use. A test that needs more must extend this file.
const Module = require("module");

const same = (a, b) => String(a) === String(b);
const clone = (d) => (d === undefined ? d : structuredClone(d));
let n = 0;
const nextId = (p = "i") => `${p}${String(++n).padStart(6, "0")}`;
const resetIds = () => { n = 0; };

// Reads a value at a dotted path; arrays on the way yield every element's value.
function values(obj, path) {
  let cur = [obj];
  for (const key of path.split(".")) cur = cur.flatMap((c) => (c == null ? [undefined] : Array.isArray(c) ? c.map((e) => (e == null ? undefined : e[key])) : [c[key]]));
  return cur.flat();
}
function cond(val, v) {
  if (v instanceof RegExp) return v.test(String(val ?? ""));
  if (v === null) return val === null || val === undefined;
  if (v instanceof Date) return val instanceof Date && val.getTime() === v.getTime();
  if (v && typeof v === "object") {
    return Object.entries(v).every(([op, arg]) => {
      if (op === "$in") return arg.map(String).includes(String(val));
      if (op === "$gt") return val > arg;
      if (op === "$lt") return String(val) < String(arg);
      if (op === "$ne") return val !== arg;
      if (op === "$not") return !cond(val, arg);
      throw new Error(`fake db: unsupported operator ${op}`);
    });
  }
  return same(val, v);
}
function match(d, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === "$or") return v.some((alt) => match(d, alt));
    if (v && typeof v === "object" && "$elemMatch" in v) return (d[k] || []).some((e) => match(e, v.$elemMatch));
    return values(d, k).some((x) => cond(x, v));
  });
}
const setPath = (o, path, val) => { const ks = path.split("."); let c = o; ks.slice(0, -1).forEach((k) => { if (c[k] == null || typeof c[k] !== "object") c[k] = {}; c = c[k]; }); c[ks.at(-1)] = val; };
const unsetPath = (o, path) => { const ks = path.split("."); let c = o; for (const k of ks.slice(0, -1)) { if (c[k] == null) return; c = c[k]; } delete c[ks.at(-1)]; };

// The array element the filter matched, so "payments.$.field" updates the right entry.
function positional(d, q, path) {
  const [arr] = path.split(".$");
  const conds = Object.entries(q).filter(([k]) => k.startsWith(`${arr}.`)).map(([k, v]) => [k.slice(arr.length + 1), v]);
  return (d[arr] || []).findIndex((e) => conds.every(([k, v]) => values(e, k).some((x) => cond(x, v))));
}
function apply(d, upd, q) {
  const found = {}; // like MongoDB, the matched array entry is decided once, before any field changes
  for (const [k, v] of Object.entries(upd.$set || {})) {
    if (k.includes(".$.")) {
      const [arr, rest] = k.split(".$.");
      if (!(arr in found)) found[arr] = positional(d, q, k);
      if (found[arr] >= 0) setPath(d[arr][found[arr]], rest, v);
    } else setPath(d, k, v);
  }
  for (const k of Object.keys(upd.$unset || {})) unsetPath(d, k);
  for (const [k, v] of Object.entries(upd.$inc || {})) setPath(d, k, (values(d, k)[0] || 0) + v);
  for (const [k, v] of Object.entries(upd.$push || {})) {
    d[k] = d[k] || [];
    for (const item of v.$each || [v]) d[k].push(item && typeof item === "object" && !item._id ? { _id: nextId("sub"), ...item } : item);
  }
}

function query(rows) {
  return {
    _rows: rows, select() { return this; }, lean() { return this; },
    sort(o) { const [k, dir] = Object.entries(o)[0]; const key = (v) => (v instanceof Date ? v.getTime() : String(v)); this._rows = [...this._rows].sort((a, b) => (key(a[k]) < key(b[k]) ? -dir : key(a[k]) > key(b[k]) ? dir : 0)); return this; },
    skip(x) { this._rows = this._rows.slice(x); return this; }, limit(x) { this._rows = this._rows.slice(0, x); return this; },
    then(res, rej) { return Promise.resolve(this._rows.map(clone)).then(res, rej); },
  };
}
const one = (row) => ({ select() { return this; }, lean() { return this; }, then(res, rej) { return Promise.resolve(clone(row) || null).then(res, rej); } });

// opts.unique: [[fields...]] makes create() fail with E11000 like a unique index would; opts.prefix names the ids;
// opts.defaults are schema defaults; opts.onCreate(f) may return an Error to throw at insert time.
function model(rows, opts = {}) {
  const prefix = opts.prefix || "d";
  const dupe = (f, skip) => (opts.unique || []).some((fields) => rows.some((r) => r !== skip && fields.every((k) => f[k] !== undefined && same(r[k], f[k])) && (!opts.where || opts.where(r))));
  return {
    rows: () => rows,
    find: (q = {}) => query(rows.filter((d) => match(d, q))),
    findOne: (q = {}) => { const base = query(rows.filter((d) => match(d, q))); return { select() { return this; }, lean() { return this; }, sort(o) { base.sort(o); return this; }, then(res, rej) { return Promise.resolve(clone(base._rows[0]) || null).then(res, rej); } }; },
    findById: (id) => one(rows.find((d) => same(d._id, id))),
    exists: async (q) => (rows.some((d) => match(d, q)) ? { _id: 1 } : null),
    countDocuments: async (q = {}) => rows.filter((d) => match(d, q)).length,
    create: async (f) => {
      const hook = opts.onCreate && opts.onCreate(f); // lets a test simulate a database error at the moment of insert
      if (hook) throw hook;
      f = { ...(opts.defaults || {}), ...f }; // like schema defaults
      if (dupe(f)) { const e = new Error("E11000 duplicate key"); e.code = 11000; throw e; }
      const d = { _id: nextId(prefix), createdAt: new Date(), ...clone(f) };
      rows.push(d);
      return { ...clone(d), toObject: () => clone(d) };
    },
    findOneAndUpdate: (q, upd, o = {}) => {
      let d = rows.find((x) => match(x, q));
      if (!d && o.upsert) { d = { _id: nextId(prefix), createdAt: new Date(), ...clone(upd.$setOnInsert || {}) }; rows.push(d); }
      if (!d) return one(null);
      apply(d, upd, q);
      return one(d);
    },
    updateOne: async (q, upd) => { const d = rows.find((x) => match(x, q)); if (d) apply(d, upd, q); return { modifiedCount: d ? 1 : 0 }; },
    updateMany: async (q, upd) => { const hit = rows.filter((x) => match(x, q)); hit.forEach((d) => apply(d, upd, q)); return { modifiedCount: hit.length }; },
    deleteMany: async (q) => { const keep = rows.filter((d) => !match(d, q)); const deleted = rows.length - keep.length; rows.splice(0, rows.length, ...keep); return { deletedCount: deleted }; },
  };
}

// Replaces require() for the named modules, but only for the files whose path matches `parentPattern`.
function install(stubs, parentPattern) {
  const orig = Module._load;
  Module._load = function (request, parent, ...rest) {
    if (parent && parentPattern.test(parent.filename) && Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return orig.call(this, request, parent, ...rest);
  };
  return () => { Module._load = orig; };
}

const res = () => ({ statusCode: 200, body: null, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, set(h) { Object.assign(this.headers, h); return this; }, send(b) { this.sent = b; return this; } });
const call = async (fn, req) => { const r = res(); await fn(req, r); return r; };
const paging = { parsePaging: (q) => ({ page: 1, limit: 20, skip: 0 }), escapeRegExp: (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") };

module.exports = { model, install, res, call, paging, nextId, resetIds, same, clone };
