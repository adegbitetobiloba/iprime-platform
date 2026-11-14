import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { api } from "../../api.js";
import { useSubmit } from "../../useSubmit.js";
import AuthLayout from "../../components/AuthLayout.jsx";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";

// Teacher sign-in. Linked from /teacher, not from the public login or signup pages.
export default function TeacherLogin() {
  const { user, acceptSession } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [waiting, setWaiting] = useState("");

  const submit = useSubmit(async () => {
    setWaiting("");
    try {
      const d = await api("/teacher/auth/login", { method: "POST", body: { email: email.trim(), password } });
      acceptSession(d.token, d.user);
      navigate(state && state.from && state.from.startsWith("/teacher") ? state.from : "/teacher/dashboard", { replace: true });
    } catch (e) {
      if (e.code === "NOT_VERIFIED") { navigate(`/teacher?verify=${encodeURIComponent(email.trim())}`); return; }
      if (e.code === "PENDING_APPROVAL" || e.code === "ACCOUNT_REJECTED" || e.code === "ACCOUNT_SUSPENDED") { setWaiting(e.message); return; }
      throw e;
    }
  });

  if (user && user.role === "teacher") return <Navigate to="/teacher/dashboard" replace />;

  return (
    <AuthLayout title="Teacher sign in" subtitle="For approved Prime Excelerate Tutelage teachers." footer={<>New teacher? <Link to="/teacher">Apply for a teacher account</Link></>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); submit.run(); }} noValidate>
        {waiting && <div className="alert alert-info" role="status">{waiting}</div>}
        <Field label="Email" id="t-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" id="t-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <FormStatus error={submit.error} slow={submit.slow} />
        <button className="btn btn-primary" disabled={submit.loading}>{submit.loading ? "Signing in…" : "Sign in"}</button>
      </form>
    </AuthLayout>
  );
}
