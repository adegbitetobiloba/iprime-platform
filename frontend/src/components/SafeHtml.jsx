import { sanitizeHtml } from "../lib/import/html.js";
import "../rich.css";

// Shows question content that may carry formatting (underlining, paragraphs, line breaks).
// The server already sanitises it; it is sanitised again here, so unsafe markup can never reach the page.
export default function SafeHtml({ html, text, as: Tag = "div", className = "", inline = false }) {
  if (!html) return <Tag className={`rich-plain ${className}`.trim()}>{text}</Tag>;
  let clean = sanitizeHtml(html);
  if (inline) clean = clean.replace(/<\/?p>/g, " ").replace(/\s+/g, " ").trim();
  return <Tag className={`rich ${className}`.trim()} dangerouslySetInnerHTML={{ __html: clean }} />;
}
