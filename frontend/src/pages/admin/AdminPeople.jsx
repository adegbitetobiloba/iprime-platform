import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Dialog from "../../components/Dialog.jsx";
import Field from "../../components/Field.jsx";
import "../../enrolment.css";

const naira = (m) => (typeof m === "number" ? (m / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" }) : "Not set");
const day = (d) => (d ? new Date(d).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—");
const METHODS = { bank_transfer: "Bank transfer", cash: "Cash", pos: "POS", other: "Other" };
const TABS = [["overview", "Overview"], ["payment", "Payment and access"], ["verification", "Verification"], ["attendance", "Attendance"], ["delete", "Delete account"]];
const ROLES = [["", "Everyone"], ["student", "Students"], ["parent", "Parents"], ["alumni", "Alumni"], ["teacher", "Teachers"]];

function Chip({ tone, children }) { return <span className={`ops-chip ${tone || ""}`}>{children}</span>; }

function Record({ id, onClose, onChanged }) {
  const { token } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ amount: "", method: "bank_transfer", reference: "", receivedOn: "", note: "" });
  const [ask, setAsk] = useState(null); // { kind: "void"|"open"|"revoke", entryId? }
  const [reason, setReason] = useState("");
  const [ver, setVer] = useState({ identityDocumentSeen: false, guardianContacted: false, note: "" });
  const [del, setDel] = useState({ confirm: "", reason: "" });
  const [gone, setGone] = useState(null);

  const load = useCallback(async () => {
    try { setD(await api(`/admin/people/${id}`, { token })); setError(""); } catch (e) { setError(e.message); }
  }, [id, token]);
  useEffect(() => { setD(null); setTab("overview"); setMsg({ ok: "", err: "" }); setGone(null); load(); }, [load]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg({ ok: "", err: "" });
    try { await fn(); setMsg({ ok: okText, err: "" }); await load(); onChanged(); return true; } catch (e) { setMsg({ ok: "", err: e.message }); return false; } finally { setBusy(false); }
  };
  const recordPayment = () => run(async () => {
    await api(`/admin/people/${id}/payments`, { method: "POST", token, body: { amount: pay.amount.trim(), method: pay.method, ...(pay.reference.trim() ? { reference: pay.reference.trim() } : {}), ...(pay.receivedOn ? { receivedOn: pay.receivedOn } : {}), ...(pay.note.trim() ? { note: pay.note.trim() } : {}) } });
    setPay({ amount: "", method: "bank_transfer", reference: "", receivedOn: "", note: "" });
  }, "Payment recorded. The student form is now open for this student and they have been emailed.");
  const confirmAsk = async () => {
    const ok = await run(async () => {
      if (ask.kind === "void") await api(`/admin/people/${id}/payments/${ask.entryId}/void`, { method: "POST", token, body: { reason: reason.trim() } });
      if (ask.kind === "open") await api(`/admin/people/${id}/features`, { method: "PATCH", token, body: { enrolmentForm: true, reason: reason.trim() } });
      if (ask.kind === "revoke") await api(`/admin/people/${id}/verification`, { method: "POST", token, body: { action: "revoke", note: reason.trim() } });
    }, ask.kind === "void" ? "Payment voided." : ask.kind === "open" ? "The student form is open for this student." : "Verification removed.");
    if (ok) { setAsk(null); setReason(""); }
  };
  const closeForm = () => run(() => api(`/admin/people/${id}/features`, { method: "PATCH", token, body: { enrolmentForm: false } }), "The student form is closed for this student.");
  const verify = () => run(() => api(`/admin/people/${id}/verification`, { method: "POST", token, body: { action: "verify", identityDocumentSeen: ver.identityDocumentSeen, guardianContacted: ver.guardianContacted, note: ver.note.trim() } }), "Student verified.");
  const removeAccount = async () => {
    setBusy(true); setMsg({ ok: "", err: "" });
    try { const r = await api(`/admin/people/${id}`, { method: "DELETE", token, body: { confirm: del.confirm.trim(), reason: del.reason.trim() } }); setGone(r.erased); onChanged(); } catch (e) { setMsg({ ok: "", err: e.message }); } finally { setBusy(false); }
  };

  if (gone) return (
    <section className="adm-detail"><div className="adm-body"><h2>Account deleted</h2><p>The account can no longer sign in and its personal data has been erased.</p><button type="button" className="btn btn-primary" onClick={onClose}>Back to the list</button></div></section>
  );

  const p = d?.person; const a = d?.access;
  const needReason = ask && ask.kind !== "revoke" ? true : !!ask;
  const tabs = TABS.filter(([k]) => d?.isStudent || ["overview", "delete"].includes(k));

  return (
    <section className="adm-detail" aria-label="Person record">
      <div className="adm-detail-head">
        <div className="adm-detail-title">
          <h2>{p ? p.name : "Person"}{p?.studentId ? <span className="muted" style={{ fontWeight: 600 }}> · {p.studentId}</span> : null}</h2>
          <button type="button" className="link-btn" onClick={onClose}>Close</button>
        </div>
        {p && <p style={{ margin: 0 }}><Chip>{p.role}</Chip>{d.isStudent && <><Chip tone={a.paymentStatus === "confirmed" ? "ok" : "warn"}>Payment {a.paymentStatus === "confirmed" ? "confirmed" : "awaiting"}</Chip><Chip tone={a.verification.status === "verified" ? "ok" : a.verification.status === "revoked" ? "bad" : "warn"}>Identity {a.verification.status}</Chip><Chip tone={a.features.enrolmentForm ? "ok" : ""}>Form {a.features.enrolmentForm ? "open" : "locked"}</Chip></>}</p>}
        {d && <div className="adm-tabs" role="tablist" aria-label="Record sections" style={{ margin: 0 }}>{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className="adm-tab" onClick={() => setTab(k)}>{l}</button>)}</div>}
      </div>
      <div className="adm-body" role="tabpanel">
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        {!d && !error && <p className="muted" style={{ paddingTop: 12 }}>Loading...</p>}
        {msg.ok && <p className="alert alert-success" role="status">{msg.ok}</p>}
        {msg.err && <p className="alert alert-error" role="alert">{msg.err}</p>}

        {d && tab === "overview" && (
          <>
            <dl className="adm-kv">
              <div><dt>Email</dt><dd>{p.email}</dd></div><div><dt>Phone</dt><dd>{p.phone || "Not provided"}</dd></div><div><dt>State</dt><dd>{p.state || "Not provided"}</dd></div>
              <div><dt>Email verified</dt><dd>{p.isVerified ? "Yes" : "No"}</dd></div><div><dt>Account approval</dt><dd>{p.approval}</dd></div><div><dt>Joined</dt><dd>{day(p.joined)}</dd></div>
              {d.isStudent && <><div><dt>Application</dt><dd>{d.enrolment ? `${d.enrolment.reference} · ${d.enrolment.status.replace(/_/g, " ")}` : "None submitted"}</dd></div><div><dt>Messaging</dt><dd>{d.messaging.blocked ? "Turned off" : "On"}{d.messaging.unread ? ` · ${d.messaging.unread} unread` : ""} · <Link to={`/admin/messages?student=${p.id}`}>Open conversation</Link></dd></div></>}
            </dl>
            {d.enrolment && <p><Link to="/admin/applications">Open applications</Link></p>}
          </>
        )}

        {d && tab === "payment" && (
          <>
            <p className="adm-note">Payments are recorded by hand. Only record one after you have seen it on the bank statement or on an official receipt: a screenshot or a student's word is not proof. Recording a payment opens the student form and emails the student.</p>
            <h3>Payments recorded {a.totalConfirmedMinor > 0 && <span className="muted" style={{ fontWeight: 600 }}>· total {naira(a.totalConfirmedMinor)}</span>}</h3>
            {a.payments.length === 0 ? <p className="muted">None yet.</p> : (
              <div style={{ overflowX: "auto" }}><table className="ops-table"><thead><tr><th>Amount</th><th>Method</th><th>Reference</th><th>Received</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
                {a.payments.map((x) => (
                  <tr key={x.id}><td className={x.voided ? "void" : ""}>{naira(x.amountMinor)}</td><td className={x.voided ? "void" : ""}>{METHODS[x.method]}</td><td className={x.voided ? "void" : ""}>{x.reference || "—"}</td><td>{day(x.receivedOn || x.confirmedAt)}</td>
                    <td>{x.voided ? <span className="muted">Voided: {x.voidReason}</span> : <button type="button" className="link-btn" onClick={() => { setReason(""); setAsk({ kind: "void", entryId: x.id }); }}>Void</button>}</td></tr>
                ))}
              </tbody></table></div>
            )}
            <h3 style={{ marginTop: 20 }}>Record a payment</h3>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ops-form">
                <Field label="Amount received (naira)" id="p-amount"><input id="p-amount" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder="For example 18000" /></Field>
                <Field label="How it was paid" id="p-method"><select id="p-method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Reference or receipt number" id="p-ref"><input id="p-ref" value={pay.reference} maxLength={80} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
                <Field label="Date received" id="p-date"><input id="p-date" type="date" max={new Date().toISOString().slice(0, 10)} value={pay.receivedOn} onChange={(e) => setPay({ ...pay, receivedOn: e.target.value })} /></Field>
                <div className="wide"><Field label="Note (optional)" id="p-note"><input id="p-note" value={pay.note} maxLength={300} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field></div>
              </div>
              <div className="form-actions" style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={recordPayment} disabled={!pay.amount.trim()} aria-busy={busy}>{busy ? "Saving..." : "Confirm payment received"}</button></div>
            </fieldset>
            <h3 style={{ marginTop: 22 }}>Student registration form</h3>
            <p>{a.features.enrolmentForm ? "The form is open: the student can fill it in and submit it." : "The form is locked: the student sees the payment notice instead."}{a.unlockNote ? ` It was opened without a payment because: ${a.unlockNote}` : ""}</p>
            {a.features.enrolmentForm
              ? <button type="button" className="btn btn-secondary btn-sm" onClick={closeForm} disabled={busy}>Close the form for this student</button>
              : <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setReason(""); setAsk({ kind: "open" }); }} disabled={busy}>Open the form without a payment</button>}
            <p className="muted" style={{ marginTop: 10 }}>These are the website features an administrator can switch per person today. Examinations and the Library are not switched per person yet.</p>
          </>
        )}

        {d && tab === "verification" && (
          <>
            <p className="adm-note">Verifying means you have personally seen the student's identity document. Verified students can be checked in without an override.</p>
            <p>Status: <strong>{a.verification.status}</strong>{a.verification.at ? ` · ${day(a.verification.at)}` : ""}{a.verification.note ? ` · ${a.verification.note}` : ""}</p>
            {a.verification.status === "verified" ? (
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => { setReason(""); setAsk({ kind: "revoke" }); }} disabled={busy}>Remove verification</button>
            ) : (
              <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
                <label className="check" style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={ver.identityDocumentSeen} onChange={(e) => setVer({ ...ver, identityDocumentSeen: e.target.checked })} /> I have seen the student's identity document and it matches this account.</label>
                {d.guardianRequired && <label className="check" style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={ver.guardianContacted} onChange={(e) => setVer({ ...ver, guardianContacted: e.target.checked })} /> This student is under 18 and I have contacted a parent or guardian.</label>}
                <div className="ops-form"><div className="wide"><Field label="Note (optional)" id="v-note"><input id="v-note" value={ver.note} maxLength={300} onChange={(e) => setVer({ ...ver, note: e.target.value })} /></Field></div></div>
                <div className="form-actions" style={{ marginTop: 12 }}><button type="button" className="btn btn-primary" onClick={verify} disabled={!ver.identityDocumentSeen} aria-busy={busy}>{busy ? "Saving..." : "Verify this student"}</button></div>
              </fieldset>
            )}
          </>
        )}

        {d && tab === "attendance" && (
          <>
            <p><span className="ops-big">{d.attendance.daysPresentLast30}</span> day{d.attendance.daysPresentLast30 === 1 ? "" : "s"} present in the last 30 days.</p>
            {d.attendance.recent.length === 0 ? <p className="muted">No check-ins yet.</p> : <ul>{d.attendance.recent.map((x) => <li key={x.id}>{day(x.day)} · {x.session} · {x.status}{x.override ? " · checked in by override" : ""}</li>)}</ul>}
            <p><Link to="/admin/checkin" className="btn btn-secondary btn-sm">Go to check-in</Link></p>
          </>
        )}

        {d && tab === "delete" && (
          <div className="ops-danger">
            <h3 style={{ marginTop: 0 }}>Delete this account</h3>
            <p><strong>This cannot be undone.</strong> The person is signed out and can no longer log in. Their name, contact details, messages and attachments, student registration form, payment record and check-ins are erased.</p>
            <p>Examination results stay, but they no longer show who took them. Administrator accounts cannot be deleted here.</p>
            <div className="ops-form">
              <Field label={p.role === "student" && p.studentId ? `Type the student ID (${p.studentId}) to confirm` : `Type the email (${p.email}) to confirm`} id="d-confirm"><input id="d-confirm" value={del.confirm} autoComplete="off" onChange={(e) => setDel({ ...del, confirm: e.target.value })} /></Field>
              <Field label="Reason (kept in the audit record, without the person's name)" id="d-reason"><input id="d-reason" value={del.reason} maxLength={300} onChange={(e) => setDel({ ...del, reason: e.target.value })} /></Field>
            </div>
            <div className="form-actions" style={{ marginTop: 12 }}><button type="button" className="btn btn-danger-outline" onClick={removeAccount} disabled={busy || !del.confirm.trim() || del.reason.trim().length < 5} aria-busy={busy}>{busy ? "Deleting..." : "Delete this account permanently"}</button></div>
          </div>
        )}
      </div>

      {ask && (
        <Dialog role="alertdialog" title={ask.kind === "void" ? "Void this payment?" : ask.kind === "open" ? "Open the form without a payment?" : "Remove this student's verification?"} description={ask.kind === "void" ? "The payment stays in the record, marked as voided with your reason. If it was the only payment, the student form closes again." : ask.kind === "open" ? "Use this only for an exception, such as a waived fee. Your reason is kept in the audit record." : "The student will need to be verified again before a normal check-in."} onClose={() => setAsk(null)} busy={busy}>
          <Field label="Reason (required)" id="ask-reason"><textarea id="ask-reason" rows="3" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="form-actions" style={{ marginTop: "var(--s4)" }}>
            <button type="button" className="btn btn-primary" disabled={busy || (needReason && reason.trim().length < 5)} aria-busy={busy} onClick={confirmAsk}>{busy ? "Saving..." : "Confirm"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setAsk(null)} disabled={busy}>Cancel</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

export default function AdminPeople() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const sel = params.get("person") || "";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("student");
  const [list, setList] = useState({ loading: true, error: "", items: [], total: 0 });
  const load = useCallback(async () => {
    try { const d = await api(`/admin/people?role=${role}&search=${encodeURIComponent(search.trim())}`, { token }); setList({ loading: false, error: "", items: d.people, total: d.total }); }
    catch (e) { setList((p) => ({ ...p, loading: false, error: e.message })); }
  }, [token, role, search]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Admissions</p><h1>People and records</h1><p>Find a person to confirm a payment, open or close their registration form, verify their identity, see their attendance, or delete their account.</p></div></header>
      <div className={`adm-split${sel ? " has-detail" : ""}`}>
        <div className="adm-list-wrap">
          <div className="ops-form" style={{ marginTop: 0 }}>
            <Field label="Search by name, email or student ID" id="pp-search"><input id="pp-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" /></Field>
            <Field label="Show" id="pp-role"><select id="pp-role" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={l} value={v}>{l}</option>)}</select></Field>
          </div>
          {list.error && <p className="alert alert-error" role="alert">{list.error}</p>}
          {list.loading && <div className="exam-card skeleton" aria-hidden="true" />}
          {!list.loading && list.items.length === 0 && !list.error && <EmptyState icon="user" title="Nobody found">Try a different name, email or student ID.</EmptyState>}
          <ul className="adm-list" aria-label="People" style={{ marginTop: 12 }}>
            {list.items.map((u) => (
              <li key={u.id}><button type="button" className="adm-row" aria-current={sel === u.id ? "true" : undefined} onClick={() => setParams({ person: u.id })}>
                <span className="adm-row-top"><span className="adm-row-name">{u.name}</span><span className="ops-chip">{u.role}</span></span>
                <span className="adm-row-meta">{u.studentId ? `${u.studentId} · ` : ""}{u.email}</span>
              </button></li>
            ))}
          </ul>
          {list.total > list.items.length && <p className="muted">Showing the newest {list.items.length} of {list.total}. Search to narrow it down.</p>}
        </div>
        {sel && <Record key={sel} id={sel} onClose={() => setParams({})} onChanged={load} />}
      </div>
    </div>
  );
}
