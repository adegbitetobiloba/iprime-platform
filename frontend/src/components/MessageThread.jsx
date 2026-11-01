import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../messages.css";

const when = (at) => {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
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

// viewer: "student" or "admin". Messages written by the viewer sit on the right.
export function Thread({ messages, viewer, hasMore, onLoadOlder, loadingOlder, emptyText }) {
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
            <p className="msg-bubble">
              {m.context && <ResultCard c={m.context} link={viewer === "student"} />}
              {m.body}
            </p>
            <span className="msg-time">{when(m.at)}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// children: optional extra controls shown above the box (for example the "attach a result" picker)
export function Composer({ onSend, error, label = "Write a message", placeholder, children }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = text.trim();
  const submit = async () => {
    if (!clean || busy) return;
    setBusy(true);
    const ok = await onSend(clean);
    if (ok) setText("");
    setBusy(false);
  };
  return (
    <div className="msg-composer">
      {children}
      <label htmlFor="msg-text"><strong>{label}</strong></label>
      <textarea id="msg-text" value={text} maxLength={2000} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }} />
      {error && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="msg-composer-row">
        <span className="msg-count">{text.length} / 2000 · Ctrl+Enter to send</span>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!clean || busy} aria-busy={busy}>{busy ? "Sending..." : "Send"}</button>
      </div>
    </div>
  );
}

// Keep what is already on screen (including older pages) when a refresh arrives.
export const mergeMessages = (prev, next) => {
  const map = new Map(prev.map((m) => [m.id, m]));
  next.forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

// Refreshes every `ms` while the page is visible. Not instant: this is polling, not a live connection.
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
