// A tiny in-memory stand-in for the Attempt model: only the operations the lifecycle, sweeper and late-sync code use.
const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);

function matches(d, f) {
  return Object.entries(f).every(([k, v]) => {
    if (k === "$or") return v.some((sub) => matches(d, sub));
    if (k === "_id" && v && v.$nin) return !v.$nin.includes(d._id);
    if (v === null) return d[k] == null; // matches a missing field too, like MongoDB
    if (v instanceof Date) return d[k] != null && new Date(d[k]).getTime() === v.getTime();
    if (v && typeof v === "object") {
      if ("$exists" in v) return (d[k] !== undefined) === v.$exists;
      if ("$lte" in v) return d[k] != null && new Date(d[k]) <= v.$lte;
      if ("$gt" in v) return d[k] != null && new Date(d[k]) > v.$gt;
    }
    return d[k] === v;
  });
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let o = obj;
  for (const p of parts.slice(0, -1)) { if (typeof o[p] !== "object" || o[p] === null) o[p] = {}; o = o[p]; }
  o[parts[parts.length - 1]] = value;
}
function unsetPath(obj, path) {
  const parts = path.split(".");
  let o = obj;
  for (const p of parts.slice(0, -1)) { if (!o[p]) return; o = o[p]; }
  delete o[parts[parts.length - 1]];
}

function fakeAttemptModel(docs, hooks = {}) {
  return {
    docs,
    async updateOne(filter, update) {
      if (hooks.beforeUpdate) hooks.beforeUpdate(docs);
      const d = [...docs.values()].find((x) => matches(x, filter));
      if (!d) return { matchedCount: 0 };
      for (const [k, v] of Object.entries(update.$set || {})) setPath(d, k, v);
      for (const k of Object.keys(update.$unset || {})) unsetPath(d, k);
      for (const [k, v] of Object.entries(update.$inc || {})) d[k] = (d[k] || 0) + v;
      return { matchedCount: 1 };
    },
    findById(id) { return { lean: async () => clone(docs.get(id)) }; },
    findOneAndUpdate(filter, update) {
      return { lean: async () => {
        const d = [...docs.values()].find((x) => matches(x, filter));
        if (!d) return null;
        for (const [k, v] of Object.entries(update.$inc || {})) d[k] = (d[k] || 0) + v;
        for (const [k, v] of Object.entries(update.$set || {})) setPath(d, k, v);
        return clone(d);
      } };
    },
    find(filter) {
      let rows = [...docs.values()].filter((d) => matches(d, filter));
      const q = {
        sort() { rows.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)); return q; },
        limit(n) { rows = rows.slice(0, n); return q; },
        lean: async () => clone(rows),
      };
      return q;
    },
  };
}

// In-memory stand-in for AttemptEvent: upsert by (attemptId, eid) with $setOnInsert, plus create and countDocuments.
function fakeEventModel(rows = []) {
  return {
    rows,
    async countDocuments(f) { return rows.filter((r) => String(r.attemptId) === String(f.attemptId)).length; },
    async create(doc) { rows.push({ ...doc }); return doc; },
    async updateOne(filter, update) {
      const hit = rows.find((r) => String(r.attemptId) === String(filter.attemptId) && r.eid === filter.eid);
      if (hit) return { upsertedCount: 0, matchedCount: 1 };
      rows.push({ ...update.$setOnInsert });
      return { upsertedCount: 1, matchedCount: 0 };
    },
  };
}

module.exports = { fakeAttemptModel, fakeEventModel, clone };
