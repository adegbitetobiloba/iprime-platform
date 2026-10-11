import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";

export default function Verify() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const email = params.get("email") || "";
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = useSubmit(() => api("/auth/verify-otp", { method: "POST", body: { email, otp } }));
  const resend = useSubmit(() => api("/auth/resend-otp", { method: "POST", body: { email } }));

  const onVerify = async (e) => {
    e.preventDefault();
    const r = await verify.run();
    if (!r?.failed) navigate("/login", { state: { notice: "Email verified. You can now log in." } });
  };

  const onResend = async () => {
    setNotice("");
    const r = await resend.run();
    if (!r?.failed) {
      setNotice("If this account is waiting for verification, a new code has been sent.");
      setCooldown(60);
    }
  };

  if (!email) {
    return (
      <section className="auth"><div className="container narrow">
        <h1>Verify your email</h1>
        <p className="muted">Start from <Link to="/register">registration</Link> or <Link to="/login">log in</Link>.</p>
      </div></section>
    );
  }

  return (
    <section className="auth">
      <div className="container narrow">
        <h1>Verify your email</h1>
        <p className="muted">Enter the 6-digit code sent to <strong>{email}</strong>. It expires after 5 minutes.</p>
        <form className="card form" onSubmit={onVerify}>
          <Field
            label="Verification code" id="otp" value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="otp-input"
          />
          <FormStatus error={verify.error || resend.error} slow={verify.slow || resend.slow} notice={notice} />
          <button className="btn btn-primary btn-block" type="submit" disabled={verify.loading || otp.length !== 6}>
            {verify.loading ? "Checking..." : "Verify"}
          </button>
          <button className="btn btn-secondary btn-block" type="button" onClick={onResend} disabled={resend.loading || cooldown > 0}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resend.loading ? "Sending..." : "Resend code"}
          </button>
        </form>
      </div>
    </section>
  );
}
