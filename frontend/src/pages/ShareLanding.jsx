import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { checkName } from "../lib/guestName.js";
import { label as durationLabel } from "../lib/exam/duration.js";
import "./share.css";

const shortTime = (m) => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`; };

function StateCard({ icon = "!", title, text }) {
  return (
    <div className="sl"><div className="sl-wrap"><div className="sl-card sl-state">
      <div className="sl-icon" aria-hidden="true">{icon}</div>
      <h1>{title}</h1><p role="alert">{text}</p>
      <p className="sl-brand">Prime Excelerate Tutelage</p>
    </div></div></div>
  );
}

// The page an examiner's link opens. Anyone can read it; to sit the examination a person without an account MUST enter a
// name (and the examination password, if the examiner set one).
export default function ShareLanding() {
  const { token: linkToken } = useParams();
  const nav = useNavigate();
  const { token, user, acceptSession } = useAuth();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [f, setF] = useState({ name: "", contact: "", password: "", agree: false });
  const [bad, setBad] = useState({ field: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { let off = false; api(`/share/${linkToken}`).then((d) => { if (!off) setInfo(d); }).catch((e) => { if (!off) setLoadError(e.message); }); return () => { off = true; }; }, [linkToken]);
  const set = (k) => (e) => { setBad({ field: "", message: "" }); setError(""); setF((x) => ({ ...x, [k]: k === "agree" ? e.target.checked : e.target.value })); };
  const fail = (field, message) => { setBad({ field, message }); document.getElementById(field)?.focus(); };

  if (loadError) return <StateCard title="We could not open this link" text={loadError} />;
  if (!info) return <div className="sl"><p className="page-note" role="status" style={{ padding: "3rem 1.25rem", textAlign: "center" }}>Opening your link...</p></div>;
  if (info.state !== "open" && info.state !== "full") return <StateCard title="This link cannot be used" text={info.message} />;

  const { exam, share, lockedBrowser } = info;
  const full = info.state === "full";
  const guestOk = share.mode !== "account", accountOk = share.mode !== "guest";
  const realUser = user && !user.guest && (user.role === "student" || user.role === "admin");
  const resumeGuest = user && user.guest;
  const blockedByBrowser = lockedBrowser.required && !lockedBrowser.ok;

  const enter = async (e) => {
    e.preventDefault();
    const n = checkName(f.name); if (!n.ok) return fail("g-name", n.error);
    if (share.requireContact && !f.contact.trim()) return fail("g-contact", "Please enter an email address or phone number.");
    if (share.needsPassword && !f.password) return fail("g-pw", "Enter the examination password.");
    if (!f.agree) return fail("g-agree", "Please tick the box to continue.");
    setBusy(true); setError("");
    try {
      const d = await api(`/share/${linkToken}/enter`, { method: "POST", body: { name: n.value, contact: f.contact, password: f.password, agree: true } });
      acceptSession(d.token, d.user);
      nav(`/exams/${d.examId}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const continueAsAccount = async (e) => {
    e.preventDefault();
    if (share.needsPassword && !f.password) return fail("pw-a", "Enter the examination password.");
    setBusy(true); setError("");
    try {
      const r = await api(`/share/${linkToken}/redeem`, { method: "POST", token, body: {} });
      if (share.needsPassword) await api(`/share/exams/${r.examId}/unlock`, { method: "POST", token, body: { password: f.password } });
      nav(`/exams/${r.examId}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const err = (id) => (bad.field === id ? bad.message : "");
  const summary = bad.message || error;

  return (
    <div className="sl">
      <header className="sl-hero"><div className="sl-wrap">
        <p className="sl-eyebrow">Prime Excelerate Tutelage · iPrime</p>
        <h1>{exam.title}</h1>
        <p className="sl-sub">{[exam.subject, exam.level].filter(Boolean).join(" · ") || "Online examination"}</p>
      </div></header>

      <div className="sl-wrap">
        <dl className="sl-facts" aria-label="About this examination">
          <div><dt>Questions</dt><dd>{exam.questionCount}</dd></div>
          <div><dt>Marks</dt><dd>{exam.totalMarks}</dd></div>
          <div><dt>Time allowed</dt><dd title={durationLabel(exam.durationMinutes)}>{shortTime(exam.durationMinutes)}</dd></div>
          <div><dt>{exam.maxAttempts === 1 ? "Attempt" : "Attempts"}</dt><dd>{exam.maxAttempts}</dd></div>
        </dl>

        <div className="sl-grid">
          <section className="sl-card sl-form-card" aria-labelledby="sl-form-h">
            {resumeGuest && (
              <>
                <h2 id="sl-form-h">Welcome back, {user.firstName}</h2>
                <p className="sl-lead">You already entered this examination on this device.</p>
                <button className="sl-btn" type="button" onClick={() => nav(`/exams/${exam.id}`)}>Carry on where I left off</button>
                <p className="sl-or">or enter again with different details</p>
              </>
            )}

            {accountOk && realUser && (
              <form onSubmit={continueAsAccount} noValidate>
                <h2 id="sl-form-h">Continue as {user.firstName}</h2>
                <p className="sl-lead">You are signed in to iPrime, so we will use your account.</p>
                {share.needsPassword && (
                  <div className="sl-field">
                    <label htmlFor="pw-a">Examination password <span className="sl-req">*</span></label>
                    <input id="pw-a" type="password" autoComplete="off" value={f.password} onChange={set("password")} aria-invalid={Boolean(err("pw-a"))} aria-describedby="sl-sum" />
                    <p className="sl-help">Your examiner gave you this. It is not your login password.</p>
                  </div>
                )}
                {summary && <p id="sl-sum" className="sl-alert sl-alert-bad" role="alert">{summary}</p>}
                <button className="sl-btn" type="submit" disabled={busy || blockedByBrowser} aria-busy={busy}>{busy ? "Opening..." : "Continue to the examination"}</button>
              </form>
            )}

            {guestOk && (
              <form onSubmit={enter} noValidate>
                {!resumeGuest && !(accountOk && realUser) && <><h2 id="sl-form-h">Let’s get you started</h2><p className="sl-lead">Tell us who you are. Your examiner will see your name next to your answers.</p></>}
                {(accountOk && realUser) && <p className="sl-or">or enter without an account</p>}
                <div className="sl-field">
                  <label htmlFor="g-name">Your full name <span className="sl-req">*</span></label>
                  <input id="g-name" type="text" autoComplete="name" maxLength={60} placeholder="For example: Ada Obi" value={f.name} onChange={set("name")} aria-required="true" aria-invalid={Boolean(err("g-name"))} aria-describedby={err("g-name") ? "sl-sum" : undefined} />
                  <p className="sl-help">This is the name that appears on your result.</p>
                </div>
                <div className="sl-field">
                  <label htmlFor="g-contact">Email or phone number {share.requireContact ? <span className="sl-req">*</span> : <span className="sl-opt">(optional)</span>}</label>
                  <input id="g-contact" type="text" autoComplete="email" maxLength={120} value={f.contact} onChange={set("contact")} aria-invalid={Boolean(err("g-contact"))} />
                  {!share.requireContact && <p className="sl-help">Helps your examiner reach you about your result.</p>}
                </div>
                {share.needsPassword && (
                  <div className="sl-field">
                    <label htmlFor="g-pw">Examination password <span className="sl-req">*</span></label>
                    <input id="g-pw" type="password" autoComplete="off" value={f.password} onChange={set("password")} aria-invalid={Boolean(err("g-pw"))} />
                    <p className="sl-help">Your examiner gave you this. It is not a login password.</p>
                  </div>
                )}
                <label className="sl-consent" htmlFor="g-agree">
                  <input id="g-agree" type="checkbox" checked={f.agree} onChange={set("agree")} aria-invalid={Boolean(err("g-agree"))} />
                  <span>I understand that my name{share.requireContact || f.contact ? ", contact details" : ""} and answers will be shared with the examiner for this examination.</span>
                </label>
                {summary && !(accountOk && realUser && !bad.field.startsWith("g-")) && <p id="sl-sum" className="sl-alert sl-alert-bad" role="alert">{summary}</p>}
                <button className="sl-btn" type="submit" disabled={busy || blockedByBrowser || (full && !f.contact)} aria-busy={busy}>{busy ? "Starting..." : "Continue to the examination"}</button>
              </form>
            )}

            {accountOk && !realUser && (
              <p className="sl-login">Already have an iPrime account? <Link to="/login" state={{ from: `/x/${linkToken}` }}>Log in</Link></p>
            )}
          </section>

          <aside>
            <section className="sl-card" aria-labelledby="sl-need-h">
              <h2 id="sl-need-h">Before you begin</h2>
              <ul className="sl-need">
                <li><span className="sl-dot" aria-hidden="true">1</span><span>Your <strong>full name</strong>{realUser ? " (we will use your account)" : ""}.</span></li>
                {share.needsPassword && <li><span className="sl-dot" aria-hidden="true">2</span><span>The <strong>examination password</strong> from your examiner.</span></li>}
                <li><span className="sl-dot" aria-hidden="true">{share.needsPassword ? 3 : 2}</span><span><strong>{durationLabel(exam.durationMinutes)}</strong> without interruption. The timer cannot be paused.</span></li>
                {lockedBrowser.required && (
                  <li className={lockedBrowser.ok ? "is-ok" : "is-bad"}>
                    <span className="sl-dot" aria-hidden="true">{lockedBrowser.ok ? "✓" : "!"}</span>
                    <span>{lockedBrowser.ok ? <><strong>Safe Exam Browser detected.</strong> You can continue.</> : <><strong>Safe Exam Browser is required.</strong> Open this link in Safe Exam Browser, using the configuration file your examiner gave you.</>}</span>
                  </li>
                )}
              </ul>
            </section>
            {full && !resumeGuest && <p className="sl-alert sl-alert-warn" role="status" style={{ marginTop: "1rem" }}>{info.message} If you already started, enter the same email or phone number you used before.</p>}
            {exam.description && <section className="sl-card" style={{ marginTop: "1rem" }}><h2>About this examination</h2><p className="sl-instr">{exam.description}</p></section>}
            {exam.instructions && <section className="sl-card" style={{ marginTop: "1rem" }}><h2>Instructions</h2><p className="sl-instr">{exam.instructions}</p></section>}
          </aside>
        </div>
        <p className="sl-brand">Prime Excelerate Tutelage · The Peak of Academic Excellence and Integrity</p>
      </div>
    </div>
  );
}
