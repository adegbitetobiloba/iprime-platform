import { Fragment } from "react";

// A small, SAFE renderer for written lessons. It builds React elements only (never raw HTML), so lesson text cannot inject scripts.
// Supported: ## / ### headings, paragraphs, bullet and numbered lists, tables, > quotes (> Definition: / > Note: become highlighted boxes),
// ```code```, **bold**, *italic*, `code`, [text](https://link), ![alt](https://image), and $math$ with H_2O / x^2 / x_{n+1} sub- and superscripts.
// Full LaTeX typesetting (fractions, roots) needs the KaTeX package; this does not pretend to do that.

const INLINE = /(\$[^$\n]+\$|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|!\[[^\]\n]*\]\(https:\/\/[^)\s]+\)|\[[^\]\n]+\]\(https:\/\/[^)\s]+\))/g;

function math(src, key) {
  const out = [];
  let last = 0;
  src.replace(/([_^])(\{[^}]*\}|[A-Za-z0-9+\-])/g, (m, op, arg, idx) => {
    if (idx > last) out.push(src.slice(last, idx));
    const text = arg.startsWith("{") ? arg.slice(1, -1) : arg;
    out.push(op === "_" ? <sub key={`${key}-${idx}`}>{text}</sub> : <sup key={`${key}-${idx}`}>{text}</sup>);
    last = idx + m.length;
    return m;
  });
  if (last < src.length) out.push(src.slice(last));
  return out;
}

export function inline(text, base = "i") {
  return text.split(INLINE).map((part, i) => {
    const key = `${base}-${i}`;
    if (!part) return null;
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) return <span key={key} className="lib-math">{math(part.slice(1, -1), key)}</span>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const img = part.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);
    if (img) return <img key={key} src={img[2]} alt={img[1]} loading="lazy" />;
    const a = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (a) return <a key={key} href={a[2]} target="_blank" rel="noopener noreferrer">{a[1]}</a>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function Markdown({ text }) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length}><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { // # is shown as h2: the page title is the only h1
      const Tag = h[1].length === 3 ? "h3" : "h2";
      blocks.push(<Tag key={blocks.length}>{inline(h[2], `h${blocks.length}`)}</Tag>);
      i++; continue;
    }
    if (line.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
      const first = buf[0] || "";
      const cls = /^(\*\*)?definition/i.test(first) ? "definition" : /^(\*\*)?(note|important|remember)/i.test(first) ? "note" : "";
      blocks.push(<blockquote key={blocks.length} className={cls}>{inline(buf.join(" "), `q${blocks.length}`)}</blockquote>);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div className="lib-table" key={blocks.length}>
          <table>
            <thead><tr>{head.map((c, k) => <th key={k} scope="col">{inline(c, `th${k}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, k) => <td key={k}>{inline(c, `td${ri}-${k}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    const ul = /^\s*[-*]\s+/, ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={blocks.length}>{items.map((t, k) => <li key={k}>{inline(t, `li${blocks.length}-${k}`)}</li>)}</Tag>);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|```|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    blocks.push(<p key={blocks.length}>{inline(buf.join(" "), `p${blocks.length}`)}</p>);
  }
  return <div className="lib-prose">{blocks}</div>;
}
