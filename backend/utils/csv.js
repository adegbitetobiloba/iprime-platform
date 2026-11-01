// Minimal CSV writer (RFC 4180 quoting, CRLF line ends, UTF-8 BOM so Excel reads names correctly).
// Spreadsheet formula injection: a TEXT cell that starts with = + - @ tab or CR is prefixed with an apostrophe so
// Excel/Sheets show it as text instead of running it. Numbers and booleans are written as they are.
const RISKY = /^[=+\-@\t\r]/;

function cell(value) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  let text = String(value);
  if (RISKY.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ header, value: (row) => any }]
function toCsv(rows, columns) {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

const safeFilename = (s) => String(s || "export").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/\.{2,}/g, ".").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";

module.exports = { toCsv, cell, safeFilename };
