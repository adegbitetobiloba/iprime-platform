import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch, fmtDate } from "../useFetch.js";
import { checkPassword } from "../lib/guestName.js";
import "../pages/admin/builder.css";

const STATE_TEXT = { open: "Active", revoked: "Withdrawn", expired: "Expired", full: "Full", unavailable: "Exam not published" };

// Examiner controls for ONE examination: its password, who can find it, Safe Exam Browser, and share links.
export default function ExamAccessPanel({ exam }) {
  const { token } = useAuth();
  const url = `/admin/access/exams/${exam._id}`;
  const { data, error, reload } = useFetch(url);
  const [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const [pw, setPw] = useState(""), [show, setShow] = useState(false);
  const [lb, setLb] = useState(null);
  const [nl, setNl] = useState({ label: "", mode: "both", requireContact: false, expiresAt: "", maxUses: "" });
  const [open, setOpen] = useState(null), [entries, setEntries] = useState(null);

  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!data) return null;
  const a = data.access;
  const lbForm = lb || { required: a.lockedBrowser.required, bek: a.lockedBrowser.browserExamKeys.join("\n"), cfg: a.lockedBrowser.configKeys.join("\n") };
  const run = async (fn, ok) => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); await reload(); } catch (e) { setErr(e.message); } };
  const lines = (s) => s.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  const link = (t) => `${window.location.origin}/x/${t}`;

  return (
    <section className="panel form form-tight" aria-labelledby="acc-h">
      <h2 className="panel-title" id="acc-h">Access, password and sharing</h2>
      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}

      <fieldset className="xb-fieldset">
        <legend>Examination password</legend>
        <p className="muted xb-help">Everyone who sits this examination, through a link or from the examination list, must enter this password before they can start. It is not a login password. You can change or remove it, but it cannot be shown again, so keep a note of it.</p>
        <p><strong>{a.password.set ? `A password is set (changed ${fmtDate(a.password.changedAt)}).` : "No password is set."}</strong></p>
        <label htmlFor="acc-pw">{a.password.set ? "New password" : "Set a password"}</label>
        <div className="xb-browser-head" style={{ border: 0, padding: 0 }}>
          <input id="acc-pw" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { const c = checkPassword(pw); if (!c.ok) return setErr(c.error); run(async () => { await api(`${url}/password`, { method: "PUT", token, body: { password: pw } }); setPw(""); }, "Password saved. Anyone who has not entered it yet will be asked for it."); }}>{a.password.set ? "Change password" : "Save password"}</button>
          {a.password.set && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm("Remove the password? Anyone with access will no longer be asked for it.")) run(() => api(`${url}/password`, { method: "DELETE", token }), "Password removed."); }}>Remove password</button>}
        </div>
      </fieldset>

      <fieldset className="xb-fieldset">
        <legend>Who can find this examination</legend>
        <label className="flag-toggle"><input type="checkbox" checked={!a.listed} onChange={(e) => run(() => api(url, { method: "PUT", token, body: { listed: !e.target.checked } }), e.target.checked ? "Link only: it no longer appears in the examination list." : "It appears in the examination list again.")} /> Link only: hide it from the examination list. People can only reach it through a share link.</label>
      </fieldset>

      <fieldset className="xb-fieldset">
        <legend>Safe Exam Browser (locked exam browser)</legend>
        <label className="flag-toggle"><input type="checkbox" checked={lbForm.required} onChange={(e) => setLb({ ...lbForm, required: e.target.checked })} /> Require Safe Exam Browser to start and sit this examination</label>
        <p className="muted xb-help">Safe Exam Browser is free. In its Config Tool, set the start address to your share link, save the configuration (with a password), and copy the <strong>Browser Exam Key</strong> it shows. Paste it here (one per line). Add a key for each version or computer type you expect. A Config Key can also be used, but anyone who can read an unprotected configuration file can work it out.</p>
        <label htmlFor="acc-bek">Browser Exam Keys (64 characters each)</label>
        <textarea id="acc-bek" rows="3" value={lbForm.bek} onChange={(e) => setLb({ ...lbForm, bek: e.target.value })} spellCheck="false" />
        <label htmlFor="acc-cfg">Config Keys (optional)</label>
        <textarea id="acc-cfg" rows="2" value={lbForm.cfg} onChange={(e) => setLb({ ...lbForm, cfg: e.target.value })} spellCheck="false" />
        <div className="form-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => run(async () => { await api(url, { method: "PUT", token, body: { lockedBrowser: { required: lbForm.required, browserExamKeys: lines(lbForm.bek), configKeys: lines(lbForm.cfg) } } }); setLb(null); }, "Locked browser settings saved.")}>Save locked browser settings</button></div>
        <p className="note">Before exam day, open <Link to={`/seb-check?exam=${exam._id}`}>this check page</Link> inside Safe Exam Browser. It tells you whether your key is accepted. Students outside Safe Exam Browser are refused when they try to start.</p>
      </fieldset>

      <fieldset className="xb-fieldset">
        <legend>Share links</legend>
        <p className="muted xb-help">People without an account must enter their <strong>name</strong> (and the examination password, if you set one) before they can start. The examination must be published.</p>
        <div className="grid-2">
          <div><label htmlFor="nl-label">Label (for your own reference)</label><input id="nl-label" maxLength={80} value={nl.label} onChange={(e) => setNl({ ...nl, label: e.target.value })} placeholder="For example: WhatsApp group" /></div>
          <div><label htmlFor="nl-mode">Who can use it</label><select id="nl-mode" value={nl.mode} onChange={(e) => setNl({ ...nl, mode: e.target.value })}><option value="both">Anyone (name) or signed-in students</option><option value="guest">Anyone, with their name</option><option value="account">Signed-in students only</option></select></div>
          <div><label htmlFor="nl-exp">Expires (optional)</label><input id="nl-exp" type="datetime-local" value={nl.expiresAt} onChange={(e) => setNl({ ...nl, expiresAt: e.target.value })} /></div>
          <div><label htmlFor="nl-max">Maximum number of people (optional)</label><input id="nl-max" type="number" min="1" value={nl.maxUses} onChange={(e) => setNl({ ...nl, maxUses: e.target.value })} /></div>
        </div>
        {nl.mode !== "account" && <label className="flag-toggle"><input type="checkbox" checked={nl.requireContact} onChange={(e) => setNl({ ...nl, requireContact: e.target.checked })} /> Also ask for an email address or phone number</label>}
        <div className="form-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => run(async () => { await api(`${url}/shares`, { method: "POST", token, body: { ...nl, expiresAt: nl.expiresAt ? new Date(nl.expiresAt).toISOString() : undefined, maxUses: nl.maxUses || undefined } }); setNl({ label: "", mode: "both", requireContact: false, expiresAt: "", maxUses: "" }); }, "Link created. Copy it below.")}>Create a share link</button></div>
        {data.shares.length === 0 && <p className="note">No links yet.</p>}
        <ul className="xb-qlist">
          {data.shares.map((s) => (
            <li key={s.id} className="xb-q" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <p><strong>{s.label || "Share link"}</strong> <span className={`badge ${s.state === "open" ? "badge-ok" : "badge-quiet"}`}>{STATE_TEXT[s.state] || s.state}</span></p>
                <p style={{ overflowWrap: "anywhere" }}><code>{link(s.token)}</code></p>
                <div className="meta"><span>{s.uses}{s.maxUses ? ` of ${s.maxUses}` : ""} people</span><span>{s.mode === "both" ? "Anyone or students" : s.mode === "guest" ? "Anyone, with name" : "Students only"}</span>{s.requireContact && <span>Contact required</span>}{s.expiresAt && <span>Expires {fmtDate(s.expiresAt)}</span>}</div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link(s.token)); setMsg("Link copied."); } catch { setErr("Could not copy. Select the link and copy it by hand."); } }}>Copy link</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={async () => { if (open === s.id) return setOpen(null); setOpen(s.id); setEntries(null); try { setEntries(await api(`/admin/access/shares/${s.id}/entries`, { token })); } catch (e) { setErr(e.message); } }}>{open === s.id ? "Hide people" : "Who used it"}</button>
                  {!s.revokedAt && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm("Withdraw this link? Nobody new will be able to use it. People already sitting the examination can finish.")) run(() => api(`/admin/access/shares/${s.id}`, { method: "DELETE", token }), "Link withdrawn."); }}>Withdraw</button>}
                </div>
                {open === s.id && entries && (
                  <ul className="plain-list">
                    {entries.guests.length + entries.accounts.length === 0 && <li className="muted">Nobody has used this link yet.</li>}
                    {entries.guests.map((g) => <li key={g.id}><strong>{g.name}</strong> (guest){g.contact ? ` · ${g.contact}` : ""} · {fmtDate(g.enteredAt)}</li>)}
                    {entries.accounts.map((g) => <li key={g.id}><strong>{g.name}</strong>{g.studentId ? ` · ${g.studentId}` : ""} · account · {fmtDate(g.openedAt)}</li>)}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="muted xb-help">See each person's answers under <Link to={`/admin/attempts?exam=${exam._id}`}>Student attempts</Link>. Guests appear there by the name they typed, marked "(guest)".</p>
      </fieldset>
    </section>
  );
}
