import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ACCEPT, MAX_FILE_BYTES, fileProblem, prettySize } from "../lib/liveMessages.js";
import "../messages.css";

const when = (at) => {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const same = d.toDateString() === new Date().toDateString();
  return same ? d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

// A comment on one real result. The figures come from the server, never typed by the sender.
function ResultCard({ c, link }) {
  const pct = typeof c.percentage === "number" ? `${Math.round(c.percentage * 10) / 10}%` : "";
  return (
    <p className="msg-result">
      <span>Comment on a result</span>
      <strong>{c.examTitle}{c.subject ? ` · ${c.subject}` : ""}</strong>
      <span>{typeof c.score === "number" ? `${c.score} out of ${c.totalMarks}` : ""}{pct ? ` (${pct})` : ""}</span>
      {link && c.attemptId && <Link to={`/results/${c.attemptId}`}>View this result</Link>}
    </p>
  );
}

// viewer: "student" or "admin". Messages written by the viewer sit on the right. onOpenFile(attachment) downloads a file.
export function Thread({ messages, viewer, hasMore, onLoadOlder, loadingOlder, emptyText, onOpenFile }) {
  const endRef = useRef(null);
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lastId]);
  return (
    <div className="msg-thread" role="log" aria-live="polite" aria-label="Messages" tabIndex={0}>
      {hasMore && <button type="button" className="btn btn-secondary btn-sm msg-older" onClick={onLoadOlder} disabled={loadingOlder}>{loadingOlder ? "Loading..." : "Show older messages"}</button>}
      {messages.length === 0 && <p className="msg-empty">{emptyText}</p>}
      {messages.map((m) => {
        const mine = m.from === viewer;
        const who = mine ? (viewer === "admin" ? m.senderName || "You" : "You") : viewer === "student" ? "Prime team" : "Student";
        return (
          <div key={m.id} className={`msg-item ${mine ? "mine" : "theirs"}`}>
            <span className="msg-who">{who}</span>
            <div className="msg-bubble">
              {m.context && <ResultCard c={m.context} link={viewer === "student"} />}
              {m.body && <span>{m.body}</span>}
              {(m.attachments || []).length > 0 && (
                <ul className="msg-files">
                  {m.attachments.map((a) => (
                    <li key={a.id}><button type="button" className="msg-file" onClick={() => onOpenFile && onOpenFile(a)}><span className="msg-file-name">{a.name}</span><span className="msg-file-size">{prettySize(a.size)}</span></button></li>
                  ))}
                </ul>
              )}
            </div>
            <span className="msg-time">{when(m.at)}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// onSend(text, fileIds) must return true when the message was sent. upload(file) must return { id, name, size }.
// children: optional extra controls shown above the box (for example the "attach a result" picker)
export function Composer({ onSend, upload, error, label = "Write a message", placeholder, disabled, disabledNote, children }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const pick = useRef(null);
  const clean = text.trim();
  const canSend = (clean || files.length > 0) && !busy && !uploading && !disabled;

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    const ok = await onSend(clean, files.map((f) => f.id));
    if (ok) { setText(""); setFiles([]); }
    setBusy(false);
  };
  const choose = async (e) => {
    const list = [...e.target.files];
    e.target.value = "";
    setFileError("");
    if (files.length + list.length > 3) { setFileError("You can attach up to 3 files to one message."); return; }
    setUploading(true);
    for (const f of list) {
      const problem = fileProblem(f);
      if (problem) { setFileError(`${f.name}: ${problem}`); continue; }
      try { const done = await upload(f); setFiles((p) => [...p, done]); } catch (err) { setFileError(`${f.name}: ${err.message}`); }
    }
    setUploading(false);
  };

  if (disabled) return <p className="alert alert-info" role="status" style={{ marginTop: 12 }}>{disabledNote}</p>;
  return (
    <div className="msg-composer">
      {children}
      <label htmlFor="msg-text"><strong>{label}</strong></label>
      <textarea id="msg-text" value={text} maxLength={2000} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }} />
      {files.length > 0 && (
        <ul className="msg-chips" aria-label="Files to send">
          {files.map((f) => <li key={f.id} className="msg-chip"><span>{f.name} · {prettySize(f.size)}</span><button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}>×</button></li>)}
        </ul>
      )}
      {(error || fileError) && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{error || fileError}</p>}
      <div className="msg-composer-row">
        <span className="msg-count">
          {upload && <><input ref={pick} type="file" accept={ACCEPT} multiple hidden onChange={choose} /><button type="button" className="btn btn-secondary btn-sm" onClick={() => pick.current?.click()} disabled={uploading || files.length >= 3} aria-busy={uploading}>{uploading ? "Uploading..." : "Attach a file"}</button>{" "}</>}
          {text.length} / 2000 · Ctrl+Enter to send{upload ? ` · PNG, JPEG or PDF up to ${MAX_FILE_BYTES / 1048576} MB` : ""}
        </span>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!canSend} aria-busy={busy}>{busy ? "Sending..." : "Send"}</button>
      </div>
    </div>
  );
}

// Keep what is already on screen (including older pages) when a refresh or a live message arrives.
export const mergeMessages = (prev, next) => {
  const map = new Map(prev.map((m) => [m.id, m]));
  next.forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

// Refreshes every `ms` while the page is visible. Now only a safety net behind the live connection.
export function usePolling(fn, ms) {
  useEffect(() => {
    fn();
    const t = setInterval(() => { if (!document.hidden) fn(); }, ms);
    const onVis = () => { if (!document.hidden) fn(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, ms]);
}
