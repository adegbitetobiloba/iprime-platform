import { createContext, useContext, useState } from "react";
import { useAuth } from "../../auth.jsx";
import { api } from "../../api.js";

export const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");

// The signed-in, approved teacher (set by TeacherLayout once the server has confirmed it).
export const TeacherContext = createContext(null);
export const useTeacher = () => useContext(TeacherContext);

// api() with the signed-in token attached: call("/teacher/courses", { method: "POST", body }).
export function useCall() {
  const { token } = useAuth();
  return (path, opts = {}) => api(path, { ...opts, token });
}

// Sends a file as the raw request body (what the library upload endpoints expect).
export async function uploadFile(path, file, token, method = "PUT") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "X-File-Name": file.name.replace(/[^\x20-\x7E]/g, "_").slice(0, 120) },
    body: file,
  });
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

// Problems the server listed (for example "Add at least one lesson."), as plain strings.
export const problemsOf = (e) => (e && Array.isArray(e.details) ? e.details.map((d) => (typeof d === "string" ? d : `${d.label ? `${d.label}: ` : ""}${d.message || ""}`)) : []);

// Runs one action at a time and remembers the error, so buttons can be disabled and the message shown.
export function useAct() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState([]);
  const run = async (fn) => {
    setBusy(true); setError(""); setDetails([]);
    try { return await fn(); } catch (e) { setError(e.message); setDetails(problemsOf(e)); return undefined; } finally { setBusy(false); }
  };
  return { busy, error, details, setError, run };
}

export const ActError = ({ act }) => (act.error ? (
  <div className="alert alert-error" role="alert">
    {act.error}
    {act.details.length > 0 && <ul>{act.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
  </div>
) : null);

export const Pill = ({ tone, children }) => <span className={`tch-pill${tone ? ` tch-${tone}` : ""}`}>{children}</span>;

export const when = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

// One word for where an item is in the review process.
export function StatusPill({ status, review }) {
  if (status === "published") return <Pill tone="ok">Published</Pill>;
  if (status === "archived") return <Pill>Archived</Pill>;
  if (review && review.status === "pending") return <Pill tone="info">Waiting for review</Pill>;
  if (review && review.status === "returned") return <Pill tone="warn">Needs changes</Pill>;
  return <Pill>Draft</Pill>;
}

export const Empty = ({ children }) => <div className="tch-empty">{children}</div>;

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-bar">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}

// Shows loading / error for a useFetch result, then the children.
export function Async({ state, children }) {
  if (state.loading) return <p className="muted" role="status">Loading…</p>;
  if (state.error) return <div className="alert alert-error" role="alert">{state.error} <button className="link-btn" onClick={state.reload}>Try again</button></div>;
  return children;
}

// Opens a private file (PDF or image) in a new tab. The browser cannot send the sign-in header by itself, so fetch it first.
export async function openFile(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Could not open the file. Please try again.");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const splitList = (s) => [...new Set(String(s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
