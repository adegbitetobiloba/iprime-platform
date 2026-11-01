// Downloads a protected file (the browser cannot send the Bearer token on a plain link).
// Same public API base as api.js. Returns { ok: true } or throws an Error whose message is safe to show.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");

export async function downloadFile(path, token, fallbackName = "download.csv") {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error("We could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error("This download is not available yet. Please try again later.");
    if (res.status === 401 || res.status === 403) throw new Error("You do not have permission to download this.");
    throw new Error("The download failed. Please try again.");
  }
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}
