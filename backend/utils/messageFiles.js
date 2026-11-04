// Checks for message attachments. Pure functions so they can be tested without a server.
const crypto = require("crypto");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB each
const MAX_PER_MESSAGE = 3;
const ALLOWED = ["image/png", "image/jpeg", "application/pdf"];

// What the bytes really are, from their first bytes (a file's name or declared type can lie).
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).toString("latin1").indexOf("%PDF-") === 0) return "application/pdf";
  return null;
}

// Returns an error message, or null when the upload is acceptable. `declared` is the Content-Type the browser sent.
function checkUpload(buf, declared) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return "No file was received.";
  if (buf.length > MAX_BYTES) return `That file is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.`;
  const real = sniff(buf);
  if (!real) return "Only PNG or JPEG pictures and PDF files can be attached.";
  const said = String(declared || "").split(";")[0].trim().toLowerCase();
  if (said !== real) return "That file's type does not match its contents.";
  if (real === "application/pdf" && buf.subarray(Math.max(0, buf.length - 2048)).toString("latin1").indexOf("%%EOF") === -1) return "That PDF looks incomplete. Please export it again.";
  return null;
}

// A display name with no path, no control characters, never empty.
function safeName(raw, contentType) {
  let name = "";
  try { name = decodeURIComponent(String(raw || "")); } catch { name = String(raw || ""); }
  name = name.split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().slice(0, 100);
  const ext = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
  return name || `attachment.${ext}`;
}
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

module.exports = { MAX_BYTES, MAX_PER_MESSAGE, ALLOWED, sniff, checkUpload, safeName, sha256 };
