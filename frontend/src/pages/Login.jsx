import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import GoogleLinkPanel from "../components/GoogleLinkPanel.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState(null); // set when Google matches an existing iPrime account

  // Back to the page they were trying to open, otherwise to the right home for their account.
  const destination = (u) => {
    const from = location.state?.from;
    if (from && from !== "/login") return from;
    return u.role === "admin" ? "/admin" : "/dashboard";
  };

  const { run, loading, slow, error } = useSubmit(() => login(email.trim(), password));

  const onSubmit = async (e) => {
    e.preventDefault();
    const r = await run();
    if (!r?.failed) navigate(destination(r));
    else if (r.error.code === "PENDING_APPROVAL") navigate("/pending-approval", { state: { email: email.trim().toLowerCase(), kind: "pending" } });
    else if (r.error.code === "NOT_VERIFIED") navigate(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  };

  if (link) {
    return (
      <AuthLayout title="We found your iPrime account" subtitle="Connect Google to it in one quick step.">
        <GoogleLinkPanel info={link} onDone={(u) => navigate(destination(u))} onCancel={() => setLink(null)} onPending={(d) => navigate("/pending-approval", { state: { email: d.email, kind: "pending" } })} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      footer={<>New to iPrime? <Link to="/register">Create an account</Link></>}
    >
      <form className="form" onSubmit={onSubmit}>
        <Field label="Email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        <Field label="Password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <FormStatus error={error} slow={slow} notice={location.state?.notice} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="auth-divider"><span>or</span></p>
      <GoogleButton
        onSignedIn={(u) => navigate(destination(u))}
        onLinkRequired={setLink}
        onPending={(d) => navigate("/pending-approval", { state: { email: d.email, kind: "pending" } })}
        onOnboarding={(d) => navigate("/onboarding", { state: { setupToken: d.setupToken, profile: d.profile } })}
      />
    </AuthLayout>
  );
}
