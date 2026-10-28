// Pure layout engine: turns pdf.js text items into reading-ordered lines, handling multi-column pages.
// No DOM, no pdf.js import: it takes plain items so it can be tested with fixtures and with the real file.
//
// Item shape (pdf.js coordinates: origin bottom-left):  { str, x, y, w, h }
// Output line:  { page, col: "L" | "R" | "S" | "F", top, x, text }
//   L/R = left/right column, S = spanning (crosses gutter / full-width) on a two-column page,
//   F = single-column ("full") page.

const WS_ONLY = /^\s*$/;

function lineText(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = "";
  let prevEnd = null;
  for (const it of sorted) {
    const s = it.str;
    if (prevEnd !== null && out && !/\s$/.test(out) && !/^\s/.test(s) && it.x - prevEnd > 1) out += " ";
    out += s;
    prevEnd = it.x + it.w;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Split a line into cells at wide horizontal gaps (e.g. footer "left text ........ Page 4").
// Used only to recognise repeated headers/footers when a page is read as one merged line.
function segmentsOf(items, gap = 25) {
  const solid = items.filter((i) => !WS_ONLY.test(i.str) && i.w > 0).sort((a, b) => a.x - b.x);
  const segs = [];
  let cur = [], prevEnd = null;
  for (const it of solid) {
    if (prevEnd !== null && it.x - prevEnd > gap) { segs.push(cur); cur = []; }
    cur.push(it);
    prevEnd = Math.max(prevEnd ?? 0, it.x + it.w);
  }
  if (cur.length) segs.push(cur);
  return segs.map((g) => lineText(g)).filter(Boolean);
}

function groupIntoLines(items, tol) {
  const withText = items.filter((i) => i.str !== "");
  const sorted = [...withText].sort((a, b) => a.top - b.top || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(it.top - last.top) <= tol) last.items.push(it);
    else lines.push({ top: it.top, items: [it] });
  }
  return lines
    .map((l) => ({ top: l.top, x: Math.min(...l.items.map((i) => i.x)), text: lineText(l.items), segments: segmentsOf(l.items), items: l.items }))
    .filter((l) => l.text !== "");
}

// Find a vertical gutter. Returns { x0, x1 } or null.
export function findGutter(solid, pageWidth, opts = {}) {
  const { minGutter = 4, centreBand = [0.35, 0.65], wideFrac = 0.55, colMinFrac = 0.3, minWideItemsPerSide = 3, wideItemFrac = 0.25 } = opts;
  const narrow = solid.filter((i) => i.w <= wideFrac * pageWidth);
  if (narrow.length < 8) return null;
  const lo = Math.floor(centreBand[0] * pageWidth);
  const hi = Math.ceil(centreBand[1] * pageWidth);
  const maxCross = Math.max(2, Math.floor(0.03 * narrow.length));
  const cover = new Array(Math.ceil(pageWidth) + 2).fill(0);
  for (const i of narrow) {
    const a = Math.max(0, Math.floor(i.x)), b = Math.min(cover.length - 1, Math.ceil(i.x + i.w));
    for (let k = a; k <= b; k++) cover[k]++;
  }
  // widest run of near-empty bins in the centre band
  let best = null, runStart = null;
  for (let k = lo; k <= hi + 1; k++) {
    const empty = k <= hi && cover[k] <= maxCross;
    if (empty && runStart === null) runStart = k;
    if (!empty && runStart !== null) {
      const run = { x0: runStart, x1: k - 1 };
      if (!best || run.x1 - run.x0 > best.x1 - best.x0) best = run;
      runStart = null;
    }
  }
  if (!best || best.x1 - best.x0 < minGutter) return null;
  // Validate: both sides must be real text columns, not a table with a wide gap.
  const left = solid.filter((i) => i.x + i.w <= best.x1 + 0.5 && i.x + i.w <= best.x1 + 0.5 && i.x < best.x0);
  const right = solid.filter((i) => i.x >= best.x0 - 0.5);
  const leftOnly = left.filter((i) => i.x + i.w <= best.x1);
  const rightOnly = right.filter((i) => i.x >= best.x0);
  const extent = (arr) => (arr.length ? Math.max(...arr.map((i) => i.x + i.w)) - Math.min(...arr.map((i) => i.x)) : 0);
  const wideCount = (arr) => arr.filter((i) => i.w >= wideItemFrac * pageWidth).length;
  if (extent(leftOnly) < colMinFrac * pageWidth || extent(rightOnly) < colMinFrac * pageWidth) return null;
  if (wideCount(leftOnly) < minWideItemsPerSide || wideCount(rightOnly) < minWideItemsPerSide) return null;
  return best;
}

export function layoutPage({ page, width, height, items }, opts = {}) {
  const all = (items || [])
    .filter((i) => typeof i.str === "string")
    .map((i) => ({ str: i.str, x: i.x, y: i.y, w: i.w || 0, h: i.h || 0, top: height - i.y }));
  const solid = all.filter((i) => !WS_ONLY.test(i.str) && i.w > 0);
  const medH = solid.length ? [...solid].map((i) => i.h).sort((a, b) => a - b)[Math.floor(solid.length / 2)] || 8 : 8;
  const tol = Math.max(1.5, 0.35 * medH);

  const gutter = findGutter(solid, width, opts);
  if (!gutter) {
    const lines = groupIntoLines(all, tol).map((l) => ({ page, col: "F", top: l.top, x: l.x, text: l.text, segments: l.segments }));
    return { page, mode: "single", gutter: null, lines };
  }

  const isSpanning = (i) => i.x < gutter.x0 && i.x + i.w > gutter.x1 || i.w > (opts.wideFrac ?? 0.55) * width;
  const spanItems = [], leftItems = [], rightItems = [];
  for (const i of all) {
    const solidItem = !WS_ONLY.test(i.str) && i.w > 0;
    if (!solidItem) {
      // whitespace-only items often stretch across the gutter: keep them only inside a column
      if (i.x + i.w <= gutter.x1) leftItems.push(i);
      else if (i.x >= gutter.x0) rightItems.push(i);
      continue;
    }
    if (isSpanning(i)) spanItems.push(i);
    else if (i.x + i.w / 2 < (gutter.x0 + gutter.x1) / 2) leftItems.push(i);
    else rightItems.push(i);
  }
  // A line made of spanning items must not also steal column items sitting on the same baseline.
  const spanLines = groupIntoLines(spanItems, tol).map((l) => ({ ...l, col: "S" }));
  const L = groupIntoLines(leftItems, tol).map((l) => ({ ...l, col: "L" }));
  const R = groupIntoLines(rightItems, tol).map((l) => ({ ...l, col: "R" }));
  const region = (l) => spanLines.filter((s) => s.top < l.top - tol).length;
  const out = [];
  for (let r = 0; r <= spanLines.length; r++) {
    for (const group of [L, R]) for (const l of group) if (region(l) === r) out.push(l);
    if (r < spanLines.length) out.push(spanLines[r]);
  }
  return { page, mode: "columns", gutter, lines: out.map((l) => ({ page, col: l.col, top: l.top, x: l.x, text: l.text, segments: l.segments })) };
}

const digitsToHash = (s) => s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();

// Whole document: lay out each page, then drop repeated headers/footers/page numbers.
// Repeat detection normalises digits so "Page 4" and "Page 17" count as the same line.
export function layoutDocument(pages, opts = {}) {
  const { edgeFrac = 0.09, minRepeat = 3, repeatFrac = 0.4 } = opts;
  const laid = pages.map((p) => ({ ...layoutPage(p, opts), height: p.height }));
  const counts = new Map();
  const isEdge = (l, h) => l.top < edgeFrac * h || l.top > (1 - edgeFrac) * h;
  const segsOf = (l) => (l.segments && l.segments.length ? l.segments : [l.text]);
  for (const p of laid) {
    const seen = new Set();
    for (const l of p.lines) if (isEdge(l, p.height)) for (const sg of segsOf(l)) seen.add(digitsToHash(sg));
    for (const k of seen) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const threshold = Math.max(minRepeat, Math.ceil(repeatFrac * laid.length));
  const furniture = new Set([...counts].filter(([, c]) => c >= threshold).map(([k]) => k));
  // An edge line made only of known repeated fragments (e.g. a footer emitted as one single text item) is furniture too.
  const fragments = [...furniture].sort((a, b) => b.length - a.length);
  const composedOfFurniture = (text) => {
    let h = digitsToHash(text);
    for (let guard = 0; guard < 6 && h; guard++) {
      const f = fragments.find((fr) => h.startsWith(fr));
      if (!f) return false;
      h = h.slice(f.length).trim();
    }
    return h === "";
  };
  const lines = [], removed = [];
  for (const p of laid) {
    for (const l of p.lines) {
      if (!isEdge(l, p.height)) { lines.push(l); continue; }
      if (furniture.size && composedOfFurniture(l.text)) { removed.push(l); continue; }
      const segs = segsOf(l);
      const kept = segs.filter((sg) => !furniture.has(digitsToHash(sg)));
      if (kept.length === segs.length) lines.push(l);
      else if (kept.length === 0) removed.push(l);
      else { lines.push({ ...l, text: kept.join(" ") }); removed.push({ ...l, text: segs.filter((sg) => furniture.has(digitsToHash(sg))).join(" ") }); }
    }
  }
  return {
    lines,
    removed,
    pages: laid.map((p) => ({ page: p.page, mode: p.mode, gutter: p.gutter, lineCount: p.lines.length })),
  };
}
