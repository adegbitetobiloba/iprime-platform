import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import "../pages/share.css";

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
  if (done) return <p className="sl-pw sl-alert sl-alert-ok" role="status" style={{ borderLeftColor: "#166534" }}>✓ Password accepted. You can start the examination.</p>;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(`/share/exams/${examId}/unlock`, { method: "POST", token, body: { password: pw } }); setDone(true); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="sl-pw" onSubmit={submit} aria-labelledby="pw-h">
      <h2 id="pw-h">This examination is password protected</h2>
      <p>Enter the password your examiner gave you, then press Start. It is not your login password.</p>
      <div className="sl-field" style={{ marginBottom: ".8rem" }}>
        <label htmlFor="exam-pw">Examination password</label>
        <input id="exam-pw" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={Boolean(error)} required />
      </div>
      {error && <p className="sl-alert sl-alert-bad" role="alert">{error}</p>}
      <button className="sl-btn" type="submit" disabled={busy || !pw} aria-busy={busy}>{busy ? "Checking..." : "Unlock examination"}</button>
    </form>
  );
}
