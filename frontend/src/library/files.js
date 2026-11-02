// Binary helpers for lesson and material PDFs. The shared api() helper only speaks JSON, so these live here.
export const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
export const MAX_PDF_MB = 20;

async function failure(res, fallback) {
  let msg = fallback;
  try { msg = (await res.json()).error || fallback; } catch { /* not JSON */ }
  const err = new Error(msg);
  err.status = res.status;
  return err;
}

// Admin: upload or replace a PDF. `path` is e.g. /admin/library/lessons/ID/pdf or /admin/library/materials/ID/pdf.
export async function uploadPdfTo(path, file, token) {
  if (!file) throw new Error("Choose a PDF file first.");
  if (file.type && file.type !== "application/pdf") throw new Error("Only PDF files can be uploaded.");
  if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`That file is larger than ${MAX_PDF_MB} MB. Compress it and try again.`);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name) }, body: file });
  } catch { throw new Error("The upload did not reach the server. Check your connection and try again."); }
  if (!res.ok) throw await failure(res, "The upload failed. Please try again.");
  return res.json();
}
export const uploadPdf = (lessonId, file, token) => uploadPdfTo(`/admin/library/lessons/${lessonId}/pdf`, file, token);

export const MAX_IMAGE_MB = 8;

// Large phone photos are shrunk in the browser before upload (longest side 2000 px, JPEG), so they load fast on weak connections.
export async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPEG, PNG or WebP images can be uploaded.");
  if (file.size <= 600 * 1024 || typeof createImageBitmap !== "function") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return blob && blob.size < file.size ? new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" }) : file;
}

export async function uploadImageTo(path, file, token) {
  const img = await prepareImage(file);
  if (img.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`"${file.name}" is larger than ${MAX_IMAGE_MB} MB even after shrinking.`);
  let res;
  try { res = await fetch(`${BASE}${path}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": img.type, "X-File-Name": encodeURIComponent(img.name) }, body: img }); }
  catch { throw new Error("The upload did not reach the server. Check your connection and try again."); }
  if (!res.ok) throw await failure(res, "The image upload failed. Please try again.");
  return res.json();
}

// Fetches a private image with the sign-in token and returns an object URL (the caller must revoke it).
export async function fetchImageUrl(path, token) {
  let res;
  try { res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } }); } catch { throw new Error("offline"); }
  if (!res.ok) throw new Error("failed");
  return URL.createObjectURL(await res.blob());
}
