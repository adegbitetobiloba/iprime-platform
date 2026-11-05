import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

// Shown on the examination intro page ONLY when the examiner set a password for this examination and this person has
// not entered it yet. It is not a login password: it unlocks this one examination.
export default function ExamPasswordPrompt({ examId }) {
  const { token } = useAuth();
  const [st, setSt] = useState(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => { let off = false; api(`/share/exams/${examId}/status`, { token }).then((d) => { if (!off) setSt(d); }).catch(() => {}); return () => { off = true; }; }, [examId, token]);
  if (!st || !st.passwordRequired || (st.unlocked && !done)) return null;
  if (done) return <p className="alert alert-success" role="status">Password accepted. You can start the examination.</p>;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`/share/exams/${examId}/unlock`, { method: "POST", token, body: { password: pw } }); setDone(true); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="panel form form-tight" onSubmit={submit} aria-labelledby="pw-h">
      <h2 className="panel-title" id="pw-h">This examination needs a password</h2>
      <p className="muted">Your examiner gave you a password for this examination. It is not your login password.</p>
      <label htmlFor="exam-pw">Examination password</label>
      <input id="exam-pw" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} required />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={busy || !pw} aria-busy={busy}>{busy ? "Checking..." : "Unlock examination"}</button></div>
    </form>
  );
}
