// HTTP Range parsing for PDF streaming, so the reader can fetch only the pages it needs.
// Returns null (no range asked), "invalid" (cannot be satisfied) or { start, end } (inclusive). One range only.
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === "" && m[2] === "") || !(size > 0)) return "invalid";
  let start, end;
  if (m[1] === "") { // last N bytes
    const n = parseInt(m[2], 10);
    if (!(n > 0)) return "invalid";
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (!(start >= 0) || start >= size || end < start) return "invalid";
  return { start, end };
}
module.exports = { parseRange };
