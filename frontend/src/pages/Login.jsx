import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { run, loading, slow, error } = useSubmit(() => login(email.trim(), password));

  const onSubmit = async (e) => {
    e.preventDefault();
    const r = await run();
    if (!r?.failed) navigate("/dashboard");
    else if (r.error.code === "NOT_VERIFIED") navigate(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      footer={<>New here? <Link to="/register">Create an account</Link></>}
    >
      <form className="form" onSubmit={onSubmit}>
        <Field label="Email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        <Field label="Password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <FormStatus error={error} slow={slow} notice={location.state?.notice} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
