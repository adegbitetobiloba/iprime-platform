import { useEffect, useRef } from "react";

// Same base URL as api.js (kept separate so the shared file does not need to change).
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ACCEPT = "image/png,image/jpeg,application/pdf";
const TYPES = ["image/png", "image/jpeg", "application/pdf"];

export const prettySize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Quick checks before uploading. The server checks again from the file's real bytes.
export function fileProblem(file) {
  if (!TYPES.includes(file.type)) return "Only PNG or JPEG pictures and PDF files can be attached.";
  if (file.size > MAX_FILE_BYTES) return "That file is too large. The limit is 2 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

// Sends the file's raw bytes as the request body (the server reads them as the file).
export async function uploadFile(path, file, token) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file });
  } catch { throw new Error("We could not reach the server. Check your connection and try again."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The file could not be uploaded.");
  return data.file;
}

// Downloads a private file with the signed-in request, then saves it.
export async function downloadFile(path, token, name) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("That file could not be opened.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name || "attachment"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Instant delivery. Keeps one connection open and calls onEvent for every message the server pushes.
// EventSource cannot send our sign-in header, so this reads the stream with fetch. It reconnects by itself; the pages also
// keep a slow refresh, so a dropped connection never loses a message.
export function useLiveStream(path, token, onEvent) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    if (!token || !path) return undefined;
    const ctrl = new AbortController();
    let stopped = false;
    let wait = 2000;
    (async () => {
      while (!stopped) {
        try {
          const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" }, signal: ctrl.signal });
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          wait = 2000;
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              const line = buf.slice(0, i).split("\n").find((l) => l.startsWith("data: "));
              buf = buf.slice(i + 2);
              if (line) { try { handler.current(JSON.parse(line.slice(6))); } catch { /* ignore a malformed frame */ } }
            }
          }
        } catch { if (stopped) return; }
        if (stopped) return;
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.min(wait * 2, 30000); // back off up to 30 seconds
      }
    })();
    return () => { stopped = true; ctrl.abort(); };
  }, [path, token]);
}
