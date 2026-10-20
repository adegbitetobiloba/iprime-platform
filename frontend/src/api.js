// All backend calls go through here. The base URL comes from VITE_API_URL (public value, never a secret).
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");

export async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    const err = new Error("We could not reach the server. Check your connection and try again.");
    err.status = 0;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  const blocked = res.status === 403 && (data.code === "PENDING_APPROVAL" || data.code === "ACCOUNT_REJECTED");
  if ((res.status === 401 || blocked) && token) {
    window.dispatchEvent(new CustomEvent("iprime:unauthorized", { detail: { reason: blocked ? data.code : "expired" } })); // the app signs out
  }
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Please try again.");
    err.status = res.status;
    err.code = data.code;
    err.details = data.errors; // e.g. per-question problems from a failed import
    throw err;
  }
  return data;
}
