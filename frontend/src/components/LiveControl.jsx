import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const CONN = { online: "Connected", quiet: "Quiet", disconnected: "Disconnected", paused: "Paused" };
const HELP = "Connected: heard from the student's screen in the last minute. Quiet: 1 to 3 minutes. Disconnected: more than 3 minutes (a dropped network, a closed tab or a flat battery). Their answers are kept on their device and sent when they reconnect.";
const clock = (s) => { const m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, "0")}`; };
const SINCE = (s) => (s < 90 ? `${s} s ago` : `${Math.round(s / 60)} min ago`);

// Live control of the students currently sitting one examination: who is connected, how far they have got, how much time
// they have left, and what an administrator can do. Refreshes every 10 seconds. Administrators only (the server enforces it).
export default function LiveControl({ examId }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [extra, setExtra] = useState("10");
  const [, tick] = useState(0);
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const d = await api(`/admin/integrity/control/exams/${examId}/live`, { token });
      fetchedAt.current = Date.now();
      setData(d); setError("");
    } catch (e) { setError(e.message); }
  }, [examId, token]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10000);
    const second = setInterval(() => tick((n) => n + 1), 1000);
    return () => { clearInterval(poll); clearInterval(second); };
  }, [load]);

  const act = async (path, body, okText) => {
    setBusy(true); setNotice(""); setError("");
    try {
      const r = await api(`/admin/integrity/control/${path}`, { method: "POST", token, body: body || {} });
      setNotice(r.done !== undefined ? `${okText} ${r.done} student${r.done === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} could not be changed)` : ""}.` : okText);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const rows = data ? data.attempts : [];
  const elapsed = Math.floor((Date.now() - fetchedAt.current) / 1000);
  const left = (a) => (a.paused ? a.remainingSeconds : Math.max(0, a.remainingSeconds - elapsed));
  const mins = Number(extra);

  return (
    <div className="panel">
      <h2 className="panel-title">Live control</h2>
      <p className="muted">Students sitting this examination right now. Refreshes every 10 seconds.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {notice && <p className="alert alert-success" role="status">{notice}</p>}
      {data && (
        <p className="lc-bar" aria-label="Summary">
          <span className="lc-pill" data-s="online">{data.counts.online} connected</span>
          <span className="lc-pill" data-s="quiet">{data.counts.quiet} quiet</span>
          <span className="lc-pill" data-s="disconnected">{data.counts.disconnected} disconnected</span>
          <span className="lc-pill" data-s="paused">{data.counts.paused} paused</span>
        </p>
      )}
      {data && rows.length === 0 && <p className="note">Nobody is sitting this examination at the moment.</p>}

      {rows.length > 0 && (
        <>
          <div className="lc-bar">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (window.confirm("Pause the examination for everyone who is sitting it? Their clocks stop until you resume.")) act(`exams/${examId}/pause-all`, {}, "Paused"); }}>Pause everyone</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(`exams/${examId}/resume-all`, {}, "Resumed")}>Resume everyone</button>
            <label>Add <select value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Minutes to add">{[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m}</option>)}</select> minutes</label>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Add ${mins} minutes for everyone who is sitting this examination?`)) act(`exams/${examId}/extend-all`, { minutes: mins }, "Added time for"); }}>to everyone</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Connection</th><th>Progress</th><th>Time left</th><th>Warnings</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.student}</strong><br /><span className="muted">{a.studentId}</span></td>
                    <td>
                      <span className="lc-pill" data-s={a.connection} title={HELP}>{CONN[a.connection]}</span>
                      <br /><span className="muted">{a.connection === "paused" ? "clock stopped" : SINCE(a.lastSignalSeconds + elapsed)}</span>
                      {a.pendingCommand && <><br /><span className="muted">Waiting to submit</span></>}
                    </td>
                    <td>{a.answered} of {a.total}</td>
                    <td className="lc-time">{clock(left(a))}{a.extraMinutes ? <><br /><span className="muted">+{a.extraMinutes} min added</span></> : null}</td>
                    <td>{a.violations > 0 ? <strong>{a.violations} of {a.maxViolations}</strong> : "0"}</td>
                    <td>
                      {a.paused
                        ? <button type="button" className="link-btn" disabled={busy} onClick={() => act(`attempts/${a.id}/resume`, {}, "Resumed.")}>Resume</button>
                        : <button type="button" className="link-btn" disabled={busy} onClick={() => act(`attempts/${a.id}/pause`, {}, "Paused.")}>Pause</button>}
                      {" · "}
                      <button type="button" className="link-btn" disabled={busy} onClick={() => act(`attempts/${a.id}/extend`, { minutes: mins }, `Added ${mins} minutes.`)}>+{mins} min</button>
                      {" · "}
                      <button type="button" className="link-btn" disabled={busy} onClick={() => { if (window.confirm(`Ask ${a.student}'s screen to submit now? Answers still on their device are sent first.`)) act(`attempts/${a.id}/force-submit`, { mode: "ask" }, "Asked their screen to submit."); }}>Ask to submit</button>
                      {" · "}
                      <button type="button" className="link-btn link-danger" disabled={busy} onClick={() => { if (window.confirm(`End ${a.student}'s examination now? It is scored with the answers the server already has. Anything still waiting on their device is lost. This cannot be undone.`)) act(`attempts/${a.id}/terminate`, {}, "Ended."); }}>End exam</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted xb-help">{HELP} &ldquo;Ask to submit&rdquo; is the gentle option: it waits for the student&apos;s screen to check in, so no answers are lost. &ldquo;End exam&rdquo; is immediate. Every action is recorded in the student&apos;s timeline under Attempts and integrity, with your name.</p>
        </>
      )}
    </div>
  );
}
