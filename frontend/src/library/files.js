// Binary helpers for lesson PDFs. The shared api() helper only speaks JSON, so these two calls live here.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
export const MAX_PDF_MB = 12;

async function failure(res, fallback) {
  let msg = fallback;
  try { msg = (await res.json()).error || fallback; } catch { /* not JSON */ }
  const err = new Error(msg);
  err.status = res.status;
  return err;
}

// Fetches the PDF into memory. There is no URL a student can copy: every request carries their sign-in token.
export async function fetchPdfBytes(lessonId, token) {
  let res;
  try { res = await fetch(`${BASE}/library/lessons/${lessonId}/pdf`, { headers: { Authorization: `Bearer ${token}` } }); }
  catch { throw new Error("We could not reach the server. Check your connection and try again."); }
  if (!res.ok) throw await failure(res, "The document could not be loaded.");
  return new Uint8Array(await res.arrayBuffer());
}

// Admin: upload or replace a lesson's PDF.
export async function uploadPdf(lessonId, file, token) {
  if (!file) throw new Error("Choose a PDF file first.");
  if (file.type && file.type !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`That file is larger than ${MAX_PDF_MB} MB. Compress it and try again.`);
  let res;
  try {
    res = await fetch(`${BASE}/admin/library/lessons/${lessonId}/pdf`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    });
  } catch { throw new Error("The upload did not reach the server. Check your connection and try again."); }
  if (!res.ok) throw await failure(res, "The upload failed. Please try again.");
  return res.json();
}
