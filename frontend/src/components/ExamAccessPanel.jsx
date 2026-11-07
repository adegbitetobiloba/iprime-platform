import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch, fmtDate } from "../useFetch.js";
import { checkPassword } from "../lib/guestName.js";
import "../pages/access.css";

const STATE_TEXT = { open: "Active", revoked: "Withdrawn", expired: "Expired", full: "Full", unavailable: "Exam not published" };
const MODE_TEXT = { both: "Anyone, or signed-in students", guest: "Anyone with a name", account: "Signed-in students only" };

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
    <section className="ax" aria-labelledby="acc-h">
      <h2 className="ax-head" id="acc-h">Access, password and sharing</h2>
      <p className="ax-intro">Control who can sit this examination and how.</p>
      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}

      <div className="ax-card">
        <h3>Examination password</h3>
        <p className="ax-lead">Everyone who sits this examination, through a link or from the examination list, must enter this password before they can start. It is not a login password. It cannot be shown again after you save it, so keep a note of it.</p>
        <p className={`ax-status${a.password.set ? " is-on" : ""}`}>{a.password.set ? `Password set · changed ${fmtDate(a.password.changedAt)}` : "No password set"}</p>
        <div className="ax-field">
          <label htmlFor="acc-pw">{a.password.set ? "New password" : "Choose a password"}</label>
          <div className="ax-row">
            <input id="acc-pw" type={show ? "text" : "password"} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 4 characters" />
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
          </div>
        </div>
        <div className="ax-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { const c = checkPassword(pw); if (!c.ok) return setErr(c.error); run(async () => { await api(`${url}/password`, { method: "PUT", token, body: { password: pw } }); setPw(""); }, "Password saved. Anyone who has not entered it yet will be asked for it."); }}>{a.password.set ? "Change password" : "Save password"}</button>
          {a.password.set && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm("Remove the password? Anyone with access will no longer be asked for it.")) run(() => api(`${url}/password`, { method: "DELETE", token }), "Password removed."); }}>Remove password</button>}
        </div>
      </div>

      <div className="ax-card">
        <h3>Who can find this examination</h3>
        <label className={`ax-toggle${!a.listed ? " is-on" : ""}`}>
          <input type="checkbox" checked={!a.listed} onChange={(e) => run(() => api(url, { method: "PUT", token, body: { listed: !e.target.checked } }), e.target.checked ? "Link only: it no longer appears in the examination list." : "It appears in the examination list again.")} />
          <span><strong>Link only</strong><small>Hide it from the examination list. People can only reach it through a share link.</small></span>
        </label>
      </div>

      <div className="ax-card">
        <h3>Safe Exam Browser (locked exam browser)</h3>
        <p className="ax-lead">Safe Exam Browser is free. In its Config Tool, set the start address to your share link, save the configuration with a password, and copy the <strong>Browser Exam Key</strong> it shows. Paste it below, one per line. Add one for each version or computer type you expect.</p>
        <label className={`ax-toggle${lbForm.required ? " is-on" : ""}`}>
          <input type="checkbox" checked={lbForm.required} onChange={(e) => setLb({ ...lbForm, required: e.target.checked })} />
          <span><strong>Require Safe Exam Browser</strong><small>Students outside it are refused when they try to start.</small></span>
        </label>
        <div className="ax-field">
          <label htmlFor="acc-bek">Browser Exam Keys <span className="ax-hint">(64 characters each)</span></label>
          <textarea id="acc-bek" value={lbForm.bek} onChange={(e) => setLb({ ...lbForm, bek: e.target.value })} spellCheck="false" />
        </div>
        <div className="ax-field">
          <label htmlFor="acc-cfg">Config Keys <span className="ax-hint">(optional; anyone who can read an unprotected configuration file can work these out)</span></label>
          <textarea id="acc-cfg" value={lbForm.cfg} onChange={(e) => setLb({ ...lbForm, cfg: e.target.value })} spellCheck="false" style={{ minHeight: 64 }} />
        </div>
        <div className="ax-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => run(async () => { await api(url, { method: "PUT", token, body: { lockedBrowser: { required: lbForm.required, browserExamKeys: lines(lbForm.bek), configKeys: lines(lbForm.cfg) } } }); setLb(null); }, "Locked browser settings saved.")}>Save locked browser settings</button></div>
        <p className="ax-note">Before exam day, open <Link to={`/seb-check?exam=${exam._id}`}>this check page</Link> inside Safe Exam Browser. It tells you whether your key is accepted.</p>
      </div>

      <div className="ax-card">
        <h3>Share links</h3>
        <p className="ax-lead">People without an account must enter their <strong>name</strong> (and the examination password, if you set one) before they can start. The examination must be published.</p>
        <div className="ax-grid">
          <div className="ax-field"><label htmlFor="nl-label">Label <span className="ax-hint">(for your own reference)</span></label><input id="nl-label" type="text" maxLength={80} value={nl.label} onChange={(e) => setNl({ ...nl, label: e.target.value })} placeholder="For example: WhatsApp group" /></div>
          <div className="ax-field"><label htmlFor="nl-mode">Who can use it</label><select id="nl-mode" value={nl.mode} onChange={(e) => setNl({ ...nl, mode: e.target.value })}>{Object.entries(MODE_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
          <div className="ax-field"><label htmlFor="nl-exp">Expires <span className="ax-hint">(optional)</span></label><input id="nl-exp" type="datetime-local" value={nl.expiresAt} onChange={(e) => setNl({ ...nl, expiresAt: e.target.value })} /></div>
          <div className="ax-field"><label htmlFor="nl-max">Maximum number of people <span className="ax-hint">(optional)</span></label><input id="nl-max" type="number" min="1" inputMode="numeric" value={nl.maxUses} onChange={(e) => setNl({ ...nl, maxUses: e.target.value })} /></div>
        </div>
        {nl.mode !== "account" && (
          <label className={`ax-toggle${nl.requireContact ? " is-on" : ""}`}>
            <input type="checkbox" checked={nl.requireContact} onChange={(e) => setNl({ ...nl, requireContact: e.target.checked })} />
            <span><strong>Also ask for an email address or phone number</strong><small>The same contact is recognised as the same person, so attempts cannot be reset by entering again.</small></span>
          </label>
        )}
        <div className="ax-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => run(async () => { await api(`${url}/shares`, { method: "POST", token, body: { ...nl, expiresAt: nl.expiresAt ? new Date(nl.expiresAt).toISOString() : undefined, maxUses: nl.maxUses || undefined } }); setNl({ label: "", mode: "both", requireContact: false, expiresAt: "", maxUses: "" }); }, "Link created. Copy it below.")}>Create a share link</button></div>

        {data.shares.length === 0 ? <p className="ax-note">No links yet.</p> : (
          <ul className="ax-links">
            {data.shares.map((s) => (
              <li key={s.id} className="ax-link">
                <div className="ax-link-top"><span className="ax-link-name">{s.label || "Share link"}</span><span className={`ax-chip${s.state === "open" ? " is-ok" : ""}`}>{STATE_TEXT[s.state] || s.state}</span></div>
                <code className="ax-url">{link(s.token)}</code>
                <div className="ax-meta"><span>{s.uses}{s.maxUses ? ` of ${s.maxUses}` : ""} {s.uses === 1 ? "person" : "people"}</span><span>{MODE_TEXT[s.mode]}</span>{s.requireContact && <span>Contact required</span>}{s.expiresAt && <span>Expires {fmtDate(s.expiresAt)}</span>}</div>
                <div className="ax-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link(s.token)); setMsg("Link copied."); } catch { setErr("Could not copy. Select the link and copy it by hand."); } }}>Copy link</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={async () => { if (open === s.id) return setOpen(null); setOpen(s.id); setEntries(null); try { setEntries(await api(`/admin/access/shares/${s.id}/entries`, { token })); } catch (e) { setErr(e.message); } }}>{open === s.id ? "Hide people" : "Who used it"}</button>
                  {!s.revokedAt && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm("Withdraw this link? Nobody new will be able to use it. People already sitting the examination can finish.")) run(() => api(`/admin/access/shares/${s.id}`, { method: "DELETE", token }), "Link withdrawn."); }}>Withdraw</button>}
                </div>
                {open === s.id && entries && (
                  <ul className="ax-people">
                    {entries.guests.length + entries.accounts.length === 0 && <li>Nobody has used this link yet.</li>}
                    {entries.guests.map((g) => <li key={g.id}><strong>{g.name}</strong> <span className="ax-chip">guest</span>{g.contact ? ` · ${g.contact}` : ""} · {fmtDate(g.enteredAt)}</li>)}
                    {entries.accounts.map((g) => <li key={g.id}><strong>{g.name}</strong>{g.studentId ? ` · ${g.studentId}` : ""} <span className="ax-chip">account</span> · {fmtDate(g.openedAt)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="ax-note">See each person's answers under <Link to={`/admin/attempts?exam=${exam._id}`}>Student attempts</Link>. Guests appear there, and in analytics and exports, by the name they typed, marked "(guest)".</p>
      </div>
    </section>
  );
}
