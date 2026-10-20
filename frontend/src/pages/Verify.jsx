import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

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
    if (r?.failed) return;
    if (r.approval === "pending") navigate("/pending-approval", { state: { email, kind: "pending", justRegistered: true } });
    else navigate("/login", { state: { notice: "Email verified. You can now log in." } });
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
      <AuthLayout title="Verify your email" subtitle="Start from registration or log in.">
        <p className="muted"><Link to="/register">Register</Link> or <Link to="/login">log in</Link>.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={<>Enter the 6-digit code sent to <strong>{email}</strong>. It expires after 5 minutes.</>}
    >
      <form className="form" onSubmit={onVerify}>
        <Field
          label="Verification code" id="otp" value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="otp-input"
        />
        <FormStatus error={verify.error || resend.error} slow={verify.slow || resend.slow} notice={notice} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={verify.loading || otp.length !== 6} aria-busy={verify.loading}>
          {verify.loading ? "Checking..." : "Verify"}
        </button>
        <button className="btn btn-secondary btn-block" type="button" onClick={onResend} disabled={resend.loading || cooldown > 0} aria-busy={resend.loading}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : resend.loading ? "Sending..." : "Resend code"}
        </button>
      </form>
    </AuthLayout>
  );
}
