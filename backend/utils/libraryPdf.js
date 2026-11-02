// Checks for uploaded PDFs. Pure functions so they can be tested without a server.
const MAX_PDF_BYTES = 12 * 1024 * 1024; // keeps each file safely under MongoDB's 16 MB document limit

// Returns an error message, or null when the buffer looks like a real PDF.
function checkPdfBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return "No file was received. Send the PDF as the request body.";
  if (buf.length > MAX_PDF_BYTES) return `That file is too large. The limit is ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB.`;
  if (buf.length < 100) return "That file is too small to be a PDF.";
  if (buf.subarray(0, 1024).toString("latin1").indexOf("%PDF-") === -1) return "That file is not a PDF.";
  // A real PDF ends with an %%EOF marker near the end; a truncated upload will not.
  if (buf.subarray(Math.max(0, buf.length - 2048)).toString("latin1").indexOf("%%EOF") === -1) return "That PDF looks incomplete. Please export it again and retry.";
  return null;
}

// A safe display name from the x-file-name header: no paths, no control characters, never empty.
function safeFileName(raw) {
  let name = "";
  try { name = decodeURIComponent(String(raw || "")); } catch { name = String(raw || ""); }
  name = name.split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().slice(0, 120);
  return name || "document.pdf";
}

module.exports = { MAX_PDF_BYTES, checkPdfBuffer, safeFileName };
