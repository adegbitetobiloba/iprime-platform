// A tiny in-memory cache with a time limit. Used for the question ids and option letters of an examination, which every
// answer save needs. Question changes are locked once students have attempts, so a minute of caching is safe and it
// removes a database read of the whole exam from every click.
function makeCache(ttlMs = 60 * 1000, max = 200) {
  const m = new Map();
  return {
    async get(key, loader, now = Date.now()) {
      const k = String(key);
      const hit = m.get(k);
      if (hit && hit.exp > now) return hit.v;
      const v = await loader();
      if (v) { // never remember "not found"
        if (m.size >= max) m.delete(m.keys().next().value);
        m.set(k, { v, exp: now + ttlMs });
      }
      return v;
    },
    clear() { m.clear(); },
    get size() { return m.size; },
  };
}
module.exports = { makeCache };
