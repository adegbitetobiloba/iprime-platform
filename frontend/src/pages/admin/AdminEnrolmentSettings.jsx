import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import Field from "../../components/Field.jsx";
import "../../enrolment.css";

// What students read on the Enrolment page before the form opens. Nothing is pre-filled with fees or bank details.
export default function AdminEnrolmentSettings() {
  const { token } = useAuth();
  const [s, setS] = useState(null);
  const [notice, setNotice] = useState("");
  const [pay, setPay] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });

  const apply = (d) => { setS(d); setNotice(d.isDefault.notice ? "" : d.notice); setPay(d.isDefault.paymentInstructions ? "" : d.paymentInstructions); };
  useEffect(() => { api("/admin/settings/enrolment", { token }).then(apply).catch((e) => setMsg({ ok: "", err: e.message })); }, [token]);

  const save = async () => {
    setBusy(true); setMsg({ ok: "", err: "" });
    try { apply(await api("/admin/settings/enrolment", { method: "PUT", token, body: { notice: notice.trim(), paymentInstructions: pay.trim() } })); setMsg({ ok: "Saved. Students see this now.", err: "" }); }
    catch (e) { setMsg({ ok: "", err: e.message }); } finally { setBusy(false); }
  };
  const shownNotice = notice.trim() || s?.notice;

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Admissions</p><h1>Enrolment notice</h1><p>Write what students read before the registration form opens. Leave a box empty to use the standard wording.</p></div></header>
      {msg.ok && <p className="alert alert-success" role="status">{msg.ok}</p>}
      {msg.err && <p className="alert alert-error" role="alert">{msg.err}</p>}
      {!s && !msg.err && <div className="exam-card skeleton" aria-hidden="true" />}
      {s && (
        <div className="ops-grid2">
          <div>
            <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ops-form">
                <div className="wide"><Field label="Notice shown to students" id="set-notice"><textarea id="set-notice" rows="5" maxLength={2000} value={notice} placeholder={s.notice} onChange={(e) => setNotice(e.target.value)} /></Field></div>
                <div className="wide"><Field label="How to pay (account details, desk, hours)" id="set-pay"><textarea id="set-pay" rows="5" maxLength={2000} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="Leave empty to tell students that the office will explain how to pay." /></Field></div>
              </div>
              <p className="muted">Only enter bank details here after you have checked them with the owner. Students see this text exactly as written.</p>
              <div className="form-actions"><button type="button" className="btn btn-primary" onClick={save} aria-busy={busy}>{busy ? "Saving..." : "Save"}</button></div>
            </fieldset>
          </div>
          <div className="ops-card" style={{ marginTop: 0 }} aria-label="Preview">
            <p className="eyebrow" style={{ margin: 0 }}>What students see</p>
            <h2 style={{ marginTop: 4 }}>The student registration form is locked for now</h2>
            <p className="enr-notice">{shownNotice}</p>
            <h3 style={{ marginBottom: 4 }}>How to pay</h3>
            <p className="enr-notice">{pay.trim() || "The office will tell you how to pay. If you are not sure, send the team a message."}</p>
          </div>
        </div>
      )}
    </div>
  );
}
