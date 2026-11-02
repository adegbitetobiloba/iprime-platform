const mongoose = require("mongoose");
const { parseRange } = require("./libraryRange");
const LibraryFile = require("../models/LibraryFile");

// GridFS access for private PDFs (same MongoDB, no extra service).
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "librarypdfs" });

function saveBuffer(buf, filename, contentType) {
  return new Promise((resolve, reject) => {
    const up = bucket().openUploadStream(filename || "document", contentType ? { contentType } : undefined);
    up.on("error", reject);
    up.on("finish", () => resolve(up.id));
    up.end(buf);
  });
}

// Removes a stored file and its metadata. Never throws: a leftover chunk must not fail a save.
async function removeFile(fileId) {
  if (!fileId) return;
  try {
    const f = await LibraryFile.findById(fileId).select("gridId");
    if (f && f.gridId) await bucket().delete(f.gridId).catch(() => {});
    await LibraryFile.deleteOne({ _id: fileId });
  } catch { /* best effort */ }
}

// Sends a PDF to an already-authorised request, honouring byte ranges and ETag so repeat visits are cheap.
// "private, no-cache": the browser may keep a private copy but must revalidate; shared caches may not store it.
async function servePdf(req, res, fileId) {
  const file = await LibraryFile.findById(fileId).select("+data gridId size sha256 contentType");
  if (!file) return res.status(404).json({ error: "The document could not be found." });
  const etag = `"${file.sha256}"`;
  res.set({
    "Content-Type": file.contentType || "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", ETag: etag,
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length, ETag",
  });
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  const r = parseRange(req.headers.range, file.size);
  if (r === "invalid") { res.set("Content-Range", `bytes */${file.size}`); return res.status(416).end(); }
  const start = r ? r.start : 0;
  const end = r ? r.end : file.size - 1;
  res.status(r ? 206 : 200);
  if (r) res.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
  res.set("Content-Length", String(end - start + 1));
  if (file.gridId) {
    const s = bucket().openDownloadStream(file.gridId, { start, end: end + 1 }); // GridFS end is exclusive
    s.on("error", () => res.destroy());
    return s.pipe(res);
  }
  if (file.data) return res.end(file.data.subarray(start, end + 1)); // files saved by the first PDF release
  return res.status(404).end();
}

module.exports = { saveBuffer, removeFile, servePdf, serveFile: servePdf };
