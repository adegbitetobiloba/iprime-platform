// Test helpers: build synthetic pdf.js-style items (origin bottom-left, A4).
export const W = 595.28, H = 841.89;
export const X = { L: 34, R: 306 };
// one text line: col "L"/"R"/number x; top = distance from top of page
export function line(col, top, str, w = 200, h = 8.2) {
  const x = typeof col === "number" ? col : X[col];
  return [{ str: "", x, y: H - top, w: 0, h }, { str, x, y: H - top, w, h }];
}
export function column(col, startTop, strs, pitch = 11.6) {
  return strs.flatMap((s, i) => line(col, startTop + i * pitch, s, Math.max(60, Math.min(250, s.length * 5))));
}
export const page = (n, items) => ({ page: n, width: W, height: H, items });
export function footer(n, merged = false) {
  const top = 819;
  if (merged) return line(34, top, `Prime Excelerate Tutelage | Volume 1 — Oral English Page ${n}`, 500, 7);
  return [...line(34, top, "Prime Excelerate Tutelage | Volume 1 — Oral English", 190, 7), ...line(537, top, `Page ${n}`, 24, 7), { str: " ", x: 224.6, y: H - top, w: 312, h: 7 }];
}
// question as text lines (ID-style)
export const q = (id, stem, opts, ans, expl = [], src = "E2-X01-Q001") => [
  `${id} ${stem}`, ...opts.map((o, i) => `${"ABCDEF"[i]}. ${o}`), `Answer: ${ans}`, ...expl, `Source: ${src}`,
];
// filler so the page has enough lines for gutter detection
export const filler = (startId, n) => Array.from({ length: n }, (_, i) => q(`ORL-${String(startId + i).padStart(4, "0")}`, "stem word long enough for width test", ["alpha one", "beta two", "gamma three", "delta four"], "A", ["Because of the rule given here in the source text."])).flat();
