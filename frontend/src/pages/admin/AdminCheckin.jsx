import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Dialog from "../../components/Dialog.jsx";
import Field from "../../components/Field.jsx";
import "../../enrolment.css";

const SESSIONS = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]];
const time = (d) => new Date(d).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
const todayKey = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10); // Nigeria is UTC+1

function Chip({ ok, children }) { return <span className={`ops-chip ${ok ? "ok" : "warn"}`}>{children}</span>; }

function StudentCard({ s, suggested, onDone }) {
  const { token } = useAuth();
  const [session, setSession] = useState(suggested || "morning");
  const [status, setStatus] = useState("present");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [override, setOverride] = useState(null); // reasons the student is not normally eligible
  const [why, setWhy] = useState("");

  const here = s.checkedInToday.map((c) => c.session);
  const go = async (overrideReason) => {
    setBusy(true); setMsg({ ok: "", err: "" });
    try {
      await api(`/admin/checkin/students/${s.id}`, { method: "POST", token, body: { session, status, ...(note.trim() ? { note: note.trim() } : {}), ...(overrideReason ? { overrideReason } : {}) } });
      setMsg({ ok: `${s.name} is checked in for the ${session} session.`, err: "" }); setOverride(null); setWhy(""); setNote(""); onDone();
    } catch (e) {
      if (e.code === "NOT_ELIGIBLE") setOverride(Array.isArray(e.details) && e.details.length ? e.details : ["This student is not eligible for a normal check-in"]);
      else setMsg({ ok: "", err: e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="ops-card ops-student">
      <div><span className="ops-big">{s.name}</span> <span className="muted">· {s.studentId || "no ID yet"}</span></div>
      <div><Chip ok={s.verified}>{s.verified ? "Identity verified" : "Not verified"}</Chip><Chip ok={s.approved}>{s.approved ? "Account approved" : "Not approved"}</Chip><Chip ok={s.paymentConfirmed}>{s.paymentConfirmed ? "Payment confirmed" : "Payment not confirmed"}</Chip></div>
      {here.length > 0 && <p style={{ margin: 0 }}>Already checked in today: {s.checkedInToday.map((c) => `${c.session} at ${time(c.at)}`).join(", ")}</p>}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="ops-form">
          <Field label="Session" id={`ci-s-${s.id}`}><select id={`ci-s-${s.id}`} value={session} onChange={(e) => setSession(e.target.value)}>{SESSIONS.map(([v, l]) => <option key={v} value={v}>{l}{here.includes(v) ? " (done)" : ""}</option>)}</select></Field>
          <Field label="Arrival" id={`ci-t-${s.id}`}><select id={`ci-t-${s.id}`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="present">On time</option><option value="late">Late</option></select></Field>
          <div className="wide"><Field label="Note (optional)" id={`ci-n-${s.id}`}><input id={`ci-n-${s.id}`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></Field></div>
        </div>
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => go()} aria-busy={busy}>{busy ? "Checking in..." : "Check in"}</button>
          {!s.verified && <Link to={`/admin/people?person=${s.id}`} className="btn btn-secondary">Verify this student</Link>}
        </div>
      </fieldset>
      {msg.ok && <p className="alert alert-success" role="status" style={{ margin: 0 }}>{msg.ok}</p>}
      {msg.err && <p className="alert alert-error" role="alert" style={{ margin: 0 }}>{msg.err}</p>}
      {override && (
        <Dialog role="alertdialog" title="This student cannot be checked in normally" description={override.join(". ") + "."} onClose={() => setOverride(null)} busy={busy}>
          <p>You can still check them in with a reason. The register will mark it as an override.</p>
          <Field label="Reason (required)" id={`ci-w-${s.id}`}><input id={`ci-w-${s.id}`} value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className="btn btn-primary" disabled={busy || why.trim().length < 5} aria-busy={busy} onClick={() => go(why.trim())}>{busy ? "Checking in..." : "Check in anyway"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setOverride(null)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function AdminCheckin() {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState(todayKey());
  const [reg, setReg] = useState(null);
  const [voidAsk, setVoidAsk] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const loadReg = useCallback(async () => {
    try { setReg(await api(`/admin/checkin/today?day=${day}`, { token })); } catch (e) { setError(e.message); }
  }, [token, day]);
  useEffect(() => { loadReg(); }, [loadReg]);
  useEffect(() => { input.current?.focus(); }, []);

  const search = useCallback(async (text) => {
    setError("");
    try { setRes(await api(`/admin/checkin/search?q=${encodeURIComponent(text.trim())}`, { token })); } catch (e) { setError(e.message); }
  }, [token]);
  useEffect(() => { if (q.trim().length < 2) { setRes(null); return undefined; } const h = setTimeout(() => search(q), 250); return () => clearTimeout(h); }, [q, search]);

  const done = () => { loadReg(); if (q.trim().length >= 2) search(q); };
  const doVoid = async () => {
    setBusy(true);
    try { await api(`/admin/checkin/${voidAsk}/void`, { method: "POST", token, body: { reason: reason.trim() } }); setVoidAsk(null); setReason(""); done(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Admissions</p><h1>Student check-in</h1><p>Find the student at the desk by name or Student ID (a barcode scanner that types the ID works too), confirm who they are, and check them in.</p></div></header>
      <div className="ops-grid2">
        <div>
          <Field label="Name or Student ID" id="ci-q"><input id="ci-q" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Start typing, or scan the ID" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--c-line-strong, #7D8BAF)", font: "inherit", fontSize: "1.05rem" }} /></Field>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {res && res.students.length === 0 && <EmptyState icon="user" title="No student found">Check the spelling, or search by Student ID.</EmptyState>}
          {res && res.students.map((s) => <StudentCard key={s.id} s={s} suggested={res.suggestedSession} onDone={done} />)}
          {!res && <p className="muted" style={{ marginTop: 12 }}>Results appear here as you type.</p>}
        </div>
        <section aria-label="Register" className="ops-card" style={{ marginTop: 0 }}>
          <div className="ops-row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Register</h2>
            <Field label="Day" id="ci-day"><input id="ci-day" type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>
          </div>
          {reg && <p style={{ margin: "8px 0" }}><strong>{reg.total}</strong> checked in · morning {reg.counts.morning} · afternoon {reg.counts.afternoon} · evening {reg.counts.evening}</p>}
          {reg && reg.entries.length === 0 && <p className="muted">Nobody has been checked in on this day.</p>}
          {reg && reg.entries.length > 0 && (
            <div style={{ overflowX: "auto" }}><table className="ops-table"><thead><tr><th>Student</th><th>Session</th><th>Time</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {reg.entries.map((e) => (
                <tr key={e.id}><td><strong>{e.name}</strong><br /><span className="muted">{e.studentCode}{e.status === "late" ? " · late" : ""}{e.override ? " · override" : ""}</span></td><td>{e.session}</td><td>{time(e.at)}<br /><span className="muted">{e.by}</span></td><td><button type="button" className="link-btn" onClick={() => { setReason(""); setVoidAsk(e.id); }}>Undo</button></td></tr>
              ))}
            </tbody></table></div>
          )}
        </section>
      </div>
      {voidAsk && (
        <Dialog role="alertdialog" title="Undo this check-in?" description="The entry stays in the record, marked as voided with your reason, and the student can then be checked in again." onClose={() => setVoidAsk(null)} busy={busy}>
          <Field label="Reason (required)" id="void-reason"><input id="void-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < 5} aria-busy={busy} onClick={doVoid}>{busy ? "Saving..." : "Undo check-in"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setVoidAsk(null)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
