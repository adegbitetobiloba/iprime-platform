// Allow-list HTML sanitiser for question content (passages, underlining, line breaks).
// Only a small set of formatting tags survives and NO attributes are ever kept, so scripts, event handlers,
// styles and links cannot get through. GENERATED COPY of backend/utils/html.js: edit the backend file and keep both identical.
const ALLOWED = new Set(["p", "br", "hr", "u", "b", "strong", "i", "em", "sub", "sup", "ul", "ol", "li", "span", "blockquote"]);
const VOID = new Set(["br", "hr"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "noscript", "template", "head", "title", "form", "textarea", "select", "button", "video", "audio", "canvas", "applet", "frameset"]);
const FORMAT_TAG_RE = /<\/?(p|br|hr|u|b|strong|i|em|sub|sup|ul|ol|li|span|div|h[1-6]|blockquote|table|tr|td|font)\b[^>]*>/i;

const escapeText = (t) => t.replace(/&(?!#\d{1,7};|#x[0-9a-fA-F]{1,6};|[a-zA-Z]{2,10};)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Does this cell look like HTML (real formatting tags), as opposed to maths such as "x<y and y>z"?
const looksLikeHtml = (s) => FORMAT_TAG_RE.test(String(s ?? ""));

function sanitizeHtml(input) {
  const src = String(input ?? "").replace(/\u0000/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const stack = [];
  let dropName = null, dropDepth = 0;
  for (const piece of src.split(/(<\/?[a-zA-Z][^<>]*>|<[!?][^<>]*>)/)) {
    if (!piece) continue;
    const isTag = /^<(\/?[a-zA-Z]|[!?])/.test(piece) && piece[piece.length - 1] === ">";
    if (!isTag) { if (!dropName) out.push(escapeText(piece)); continue; }
    const m = piece.match(/^<(\/)?([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])/);
    if (!m) { if (!dropName && !/^<[!?]/.test(piece)) out.push(escapeText(piece)); continue; } // "a < b and c > d" is text; <!doctype>, <?xml> are dropped
    const closing = !!m[1], name = m[2].toLowerCase(), selfClosing = /\/\s*>$/.test(piece);
    if (dropName) {
      if (name === dropName) { if (closing) { if (--dropDepth === 0) dropName = null; } else if (!selfClosing) dropDepth++; }
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) { if (!closing && !selfClosing) { dropName = name; dropDepth = 1; } continue; }
    if (!ALLOWED.has(name)) continue; // unknown tag: removed, its text is kept
    if (VOID.has(name)) { if (!closing) out.push(`<${name}>`); continue; }
    if (!closing) { stack.push(name); out.push(`<${name}>`); }
    else if (stack.includes(name)) { while (stack.length) { const top = stack.pop(); out.push(`</${top}>`); if (top === name) break; } }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("").trim();
}

const NAMED = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”" };
const decodeEntities = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return NAMED[e.toLowerCase()] ?? m;
});

// Plain text of (sanitised) HTML: used for search, duplicate detection and "is this empty?" checks.
function htmlToText(html) {
  return decodeEntities(String(html ?? "").replace(/<\/(p|li|blockquote)>|<br\s*\/?>|<hr\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""))
    .replace(/[ \t\u00A0]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export { sanitizeHtml, htmlToText, looksLikeHtml, ALLOWED };
