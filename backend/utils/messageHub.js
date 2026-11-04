// Instant delivery with Server-Sent Events: the server keeps a connection open and pushes new messages the moment they exist.
// This is held in memory, which is correct while the API runs as ONE server instance (as on the current Render plan).
// With several instances it would need a shared bus such as Redis. The pages keep a slow refresh as a safety net either way.
const subs = new Map(); // key -> Set<res>
const MAX_PER_KEY = 5; // one student may have a few tabs open, not hundreds

function subscribe(key, res) {
  if (!subs.has(key)) subs.set(key, new Set());
  const set = subs.get(key);
  if (key.startsWith("student:") && set.size >= MAX_PER_KEY) { const oldest = set.values().next().value; set.delete(oldest); try { oldest.end(); } catch { /* already closed */ } }
  set.add(res);
  return () => { set.delete(res); if (!set.size) subs.delete(key); };
}

function publish(keys, event) {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const key of [].concat(keys)) {
    for (const res of subs.get(key) || []) { try { res.write(frame); } catch { /* the connection closed: its close handler removes it */ } }
  }
}

// Opens the event stream for a signed-in request. `key` decides who receives what.
function open(req, res, key, heartbeatMs = 25000) {
  res.status(200);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  if (res.flushHeaders) res.flushHeaders();
  res.write("retry: 5000\n\n: connected\n\n");
  const off = subscribe(key, res);
  const beat = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* closed */ } }, heartbeatMs); // keeps proxies from closing a quiet connection
  if (beat.unref) beat.unref();
  const done = () => { clearInterval(beat); off(); };
  req.on("close", done);
  return done;
}

const count = (key) => (subs.get(key) ? subs.get(key).size : 0);
const studentKey = (id) => `student:${id}`;
const ADMIN_KEY = "admins";

module.exports = { subscribe, publish, open, count, studentKey, ADMIN_KEY, MAX_PER_KEY };
