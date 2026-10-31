// CSV reader: quoted cells, doubled quotes, line breaks inside cells, and , ; tab delimiters.
export function detectDelimiter(text) {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const count = (ch) => (head.match(new RegExp(ch === "\t" ? "\t" : `\\${ch}`, "g")) || []).length;
  return [",", ";", "\t"].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0][1] > 0 ? [",", ";", "\t"].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0][0] : ",";
}

export function parseCsv(input, delimiter) {
  const text = String(input ?? "").replace(/^\uFEFF/, "");
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") inQ = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return { rows, delimiter: d, unterminatedQuote: inQ };
}
