// Reads .xlsx workbooks in the browser with JSZip (workbook.xml, relationships, sharedStrings.xml, sheet cells).
// No DOM parser is used, so the same code runs in tests. Shared, inline, string, boolean and number cells are supported.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const textOf = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };

export const colIndex = (ref) => { const letters = ref.replace(/[^A-Za-z]/g, "").toUpperCase(); let n = 0; for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

export async function readXlsx(data, { JSZip, maxCells = 3_000_000 } = {}) {
  if (!JSZip) throw new Error("JSZip is required");
  let zip;
  try { zip = await JSZip.loadAsync(data); } catch { throw new Error("This is not a valid .xlsx file (it could not be opened as a workbook)."); }
  const read = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };
  const wb = await read("xl/workbook.xml");
  if (!wb) throw new Error("This does not look like an Excel workbook (xl/workbook.xml is missing).");
  const rels = (await read("xl/_rels/workbook.xml.rels")) || "";
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = attr(m[0], "Id"), t = attr(m[0], "Target"); if (id && t) relMap[id] = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`; }
  const shared = [];
  const ss = await read("xl/sharedStrings.xml");
  if (ss) for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));

  const sheets = [];
  let cells = 0;
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name"), rid = attr(m[0], "r:id");
    const state = attr(m[0], "state");
    const path = relMap[rid];
    const xml = path && (await read(path));
    if (!xml) { sheets.push({ name, rows: [], error: "The sheet's data could not be found in the file." }); continue; }
    const rows = [];
    let maxCol = 0;
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rowNum = parseInt(attr(rm[1], "r"), 10);
      const body = rm[2] || "";
      const cellsOfRow = [];
      for (const cm of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cm[1], "r"), t = attr(cm[1], "t"), inner = cm[2] || "";
        const ci = ref ? colIndex(ref) : cellsOfRow.length;
        let v = "";
        if (t === "inlineStr") v = textOf(inner);
        else {
          const vm = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
          const raw = vm ? decode(vm[1]) : "";
          if (t === "s") v = shared[parseInt(raw, 10)] ?? "";
          else if (t === "b") v = raw === "1" ? "TRUE" : "FALSE";
          else if (t === "e") v = "";           // error cell (#N/A ...): treated as empty, never as data
          else v = raw;                           // str (formula text result) and numbers as stored
        }
        if (++cells > maxCells) throw new Error("The workbook is too large to read in the browser.");
        cellsOfRow[ci] = v;
        if (ci + 1 > maxCol) maxCol = ci + 1;
      }
      const r = Number.isFinite(rowNum) ? rowNum - 1 : rows.length;
      while (rows.length < r) rows.push([]);
      rows[r] = Array.from(cellsOfRow, (x) => x ?? "");
      for (let i = 0; i < cellsOfRow.length; i++) if (rows[r][i] === undefined) rows[r][i] = "";
    }
    for (const r of rows) while (r.length < maxCol) r.push("");
    sheets.push({ name, rows: rows.map((r) => r || []), hidden: state === "hidden" || state === "veryHidden" });
  }
  return { sheets };
}
