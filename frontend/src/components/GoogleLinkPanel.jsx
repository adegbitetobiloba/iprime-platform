import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import Field from "./Field.jsx";
import FormStatus from "./FormStatus.jsx";

// Shown when Google says "this is ada@..." and iPrime already has an account for that email.
// Nothing is merged until the person proves the iPrime account is theirs: its password, or a code emailed to it.
export default function GoogleLinkPanel({ info, onDone, onCancel, onPending }) {
  const { acceptSession, setNotice } = useAuth();
  const canPassword = info.methods.includes("password");
  const [mode, setMode] = useState(canPassword ? "password" : "code");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState("");

  const finish = (d) => {
    if (d.status === "pending_approval") { onPending?.(d); return; } // linked, but the account still waits for approval: no sign-in
    acceptSession(d.token, d.user);
    setNotice({ kind: "ok", text: "Google is now linked to your account." });
    onDone(d.user);
  };
  const withPassword = useSubmit(async () => finish(await api("/auth/google/link-existing", { method: "POST", body: { linkToken: info.linkToken, password } })));
  const sendCode = useSubmit(async () => { const d = await api("/auth/google/link-code/send", { method: "POST", body: { linkToken: info.linkToken } }); setSent(d.message); });
  const withCode = useSubmit(async () => finish(await api("/auth/google/link-code/confirm", { method: "POST", body: { linkToken: info.linkToken, code } })));

  return (
    <div className="link-panel" role="group" aria-label="Confirm your iPrime account">
      <p className="muted">
        This Google account matches the iPrime account for <strong>{info.email}</strong>. Confirm it is yours to connect them.
        Your student ID, results and details stay exactly as they are.
      </p>

      {mode === "password" ? (
        <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); withPassword.run(); }}>
          <Field label="Your iPrime password" id="link-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" autoFocus />
          <FormStatus error={withPassword.error} slow={withPassword.slow} />
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={withPassword.loading || !password} aria-busy={withPassword.loading}>
            {withPassword.loading ? "Linking..." : "Link Google and sign in"}
          </button>
          <button type="button" className="link-btn" onClick={() => setMode("code")}>I do not remember my password. Email me a code instead.</button>
        </form>
      ) : (
        <div className="form form-tight">
          {!sent ? (
            <>
              <FormStatus error={sendCode.error} slow={sendCode.slow} />
              <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => sendCode.run()} disabled={sendCode.loading} aria-busy={sendCode.loading}>
                {sendCode.loading ? "Sending..." : `Email a code to ${info.email}`}
              </button>
            </>
          ) : (
            <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); withCode.run(); }}>
              <p className="alert alert-info" role="status">{sent}</p>
              <Field label="6-digit code" id="link-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="otp-input" autoFocus />
              <FormStatus error={withCode.error} slow={withCode.slow} />
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={withCode.loading || code.length !== 6} aria-busy={withCode.loading}>
                {withCode.loading ? "Checking..." : "Link Google and sign in"}
              </button>
              <button type="button" className="link-btn" onClick={() => { setSent(""); sendCode.setError(""); }}>Send a new code</button>
            </form>
          )}
          {canPassword && <button type="button" className="link-btn" onClick={() => setMode("password")}>Use my password instead</button>}
        </div>
      )}
      <button type="button" className="link-btn" onClick={onCancel}>Back to sign in</button>
    </div>
  );
}
