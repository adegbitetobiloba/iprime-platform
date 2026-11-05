import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { checkName } from "../lib/guestName.js";
import { label as durationLabel } from "../lib/exam/duration.js";

// The page an examiner's link opens. Anyone can read it; to sit the examination a person without an account MUST enter a
// name (and the examination password, if the examiner set one).
export default function ShareLanding() {
  const { token: linkToken } = useParams();
  const nav = useNavigate();
  const { token, user, acceptSession } = useAuth();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [f, setF] = useState({ name: "", contact: "", password: "", agree: false });
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { let off = false; api(`/share/${linkToken}`).then((d) => { if (!off) setInfo(d); }).catch((e) => { if (!off) setLoadError(e.message); }); return () => { off = true; }; }, [linkToken]);
  const set = (k) => (e) => { setFieldError(""); setError(""); setF((x) => ({ ...x, [k]: k === "agree" ? e.target.checked : e.target.value })); };

  if (loadError) return <section className="section"><div className="container narrow"><h1>Link not found</h1><p className="alert alert-error" role="alert">{loadError}</p></div></section>;
  if (!info) return <p className="page-note" role="status">Opening your link...</p>;
  if (info.state !== "open" && info.state !== "full") return <section className="section"><div className="container narrow"><h1>This link cannot be used</h1><p className="alert alert-error" role="alert">{info.message}</p></div></section>;

  const { exam, share, lockedBrowser } = info;
  const full = info.state === "full";
  const guestOk = share.mode !== "account", accountOk = share.mode !== "guest";
  const realUser = user && !user.guest && (user.role === "student" || user.role === "admin");
  const resumeGuest = user && user.guest;
  const blockedByBrowser = lockedBrowser.required && !lockedBrowser.ok;

  const enter = async (e) => {
    e.preventDefault();
    const n = checkName(f.name); if (!n.ok) return setFieldError(n.error);
    if (share.requireContact && !f.contact.trim()) return setFieldError("Please enter an email address or phone number.");
    if (share.needsPassword && !f.password) return setFieldError("Enter the examination password.");
    if (!f.agree) return setFieldError("Please tick the box to continue.");
    setBusy(true); setError("");
    try {
      const d = await api(`/share/${linkToken}/enter`, { method: "POST", body: { name: n.value, contact: f.contact, password: f.password, agree: true } });
      acceptSession(d.token, d.user);
      nav(`/exams/${d.examId}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const continueAsAccount = async (e) => {
    e.preventDefault();
    if (share.needsPassword && !f.password) return setFieldError("Enter the examination password.");
    setBusy(true); setError("");
    try {
      const r = await api(`/share/${linkToken}/redeem`, { method: "POST", token, body: {} });
      if (share.needsPassword) await api(`/share/exams/${r.examId}/unlock`, { method: "POST", token, body: { password: f.password } });
      nav(`/exams/${r.examId}`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <section className="section">
      <div className="container narrow">
        <p className="eyebrow">Prime Excelerate Tutelage</p>
        <h1>{exam.title}</h1>
        <p className="muted">{[exam.subject, exam.level].filter(Boolean).join(" · ")}</p>
        <dl className="exam-facts">
          <div><dt>Questions</dt><dd>{exam.questionCount}</dd></div>
          <div><dt>Marks</dt><dd>{exam.totalMarks}</dd></div>
          <div><dt>Time allowed</dt><dd>{durationLabel(exam.durationMinutes)}</dd></div>
          <div><dt>Attempts</dt><dd>{exam.maxAttempts}</dd></div>
        </dl>
        {exam.description && <p>{exam.description}</p>}
        {exam.instructions && <div className="panel"><h2 className="panel-title">Instructions</h2><p style={{ whiteSpace: "pre-line" }}>{exam.instructions}</p></div>}

        {lockedBrowser.required && (
          <p className={`alert ${lockedBrowser.ok ? "alert-success" : "alert-error"}`} role={lockedBrowser.ok ? "status" : "alert"}>
            {lockedBrowser.ok ? "Safe Exam Browser detected. You can continue." : "This examination must be taken in Safe Exam Browser. Open this link in Safe Exam Browser, using the configuration file your examiner gave you."}
          </p>
        )}
        {full && !resumeGuest && <p className="alert alert-error" role="alert">{info.message} If you already started, enter the same details you used before.</p>}

        {resumeGuest && <div className="panel"><p>You are already signed in to an examination as <strong>{user.firstName}</strong>.</p><button className="btn btn-primary" type="button" onClick={() => nav(`/exams/${exam.id}`)}>Carry on where I left off</button></div>}

        {accountOk && realUser && (
          <form className="panel form form-tight" onSubmit={continueAsAccount}>
            <h2 className="panel-title">Continue as {user.firstName}</h2>
            {share.needsPassword && <><label htmlFor="pw-a">Examination password</label><input id="pw-a" type="password" autoComplete="off" value={f.password} onChange={set("password")} /></>}
            {(fieldError || error) && <p className="alert alert-error" role="alert">{fieldError || error}</p>}
            <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy || blockedByBrowser} aria-busy={busy}>{busy ? "Opening..." : "Continue to the examination"}</button></div>
          </form>
        )}

        {guestOk && (
          <form className="panel form form-tight" onSubmit={enter} noValidate>
            <h2 className="panel-title">{realUser ? "Or enter without an account" : "Enter your details to begin"}</h2>
            <label htmlFor="g-name">Your full name <span className="muted">(required)</span></label>
            <input id="g-name" type="text" autoComplete="name" maxLength={60} value={f.name} onChange={set("name")} aria-required="true" aria-invalid={Boolean(fieldError) && !checkName(f.name).ok} />
            <label htmlFor="g-contact">Email or phone number {share.requireContact ? <span className="muted">(required)</span> : <span className="muted">(optional)</span>}</label>
            <input id="g-contact" type="text" autoComplete="email" maxLength={120} value={f.contact} onChange={set("contact")} />
            {share.needsPassword && <><label htmlFor="g-pw">Examination password <span className="muted">(required)</span></label><input id="g-pw" type="password" autoComplete="off" value={f.password} onChange={set("password")} /></>}
            <label className="flag-toggle"><input type="checkbox" checked={f.agree} onChange={set("agree")} /> I understand my name{share.requireContact ? ", contact" : ""} and answers will be shared with the examiner for this examination.</label>
            {(fieldError || error) && <p className="alert alert-error" role="alert">{fieldError || error}</p>}
            <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy || blockedByBrowser} aria-busy={busy}>{busy ? "Starting..." : "Continue to the examination"}</button></div>
          </form>
        )}

        {accountOk && !realUser && (
          <p className="muted">Have an iPrime account? <Link to="/login" state={{ from: `/x/${linkToken}` }}>Log in</Link> and come back to this link.</p>
        )}
      </div>
    </section>
  );
}
