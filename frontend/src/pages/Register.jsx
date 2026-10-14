import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import { STATES } from "../states.js";


export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", state: "", role: "student", password: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { run, loading, slow, error } = useSubmit(() =>
    api("/auth/register", { method: "POST", body: { ...form, country: "Nigeria" } })
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    const r = await run();
    const emailFailed = r?.failed && r.error.code === "EMAIL_FAILED";
    if (!r?.failed || emailFailed) {
      navigate(`/verify?email=${encodeURIComponent(form.email.trim().toLowerCase())}`, {
        state: emailFailed ? { notice: "Your account was created, but the verification email could not be sent. Tap Resend code." } : {},
      });
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We will email a 6-digit code to confirm your address."
      footer={<>Already registered? <Link to="/login">Log in</Link></>}
    >
      <form className="form" onSubmit={onSubmit}>
        <div className="grid-2">
          <Field label="First name" id="firstName" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" />
          <Field label="Last name" id="lastName" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />
        </div>
        <Field label="Email" id="email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" inputMode="email" />
        <Field label="Phone number" id="phone" type="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" inputMode="tel" hint="Example: 08012345678" />
        <div className="grid-2">
          <Field label="State" id="state">
            <select id="state" value={form.state} onChange={set("state")} required>
              <option value="">Select your state</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="I am registering as" id="role">
            <select id="role" value={form.role} onChange={set("role")}>
              <option value="student">A student</option>
              <option value="parent">A parent or guardian</option>
            </select>
          </Field>
        </div>
        <Field label="Password" id="password" type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={72} autoComplete="new-password" hint="At least 8 characters." />
        <FormStatus error={error} slow={slow} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="auth-divider"><span>or</span></p>
      <GoogleButton role={form.role} onDone={() => navigate("/dashboard")} />
      <p className="hint center">With Google, you will add your phone number and state afterwards in your profile.</p>
    </AuthLayout>
  );
}
