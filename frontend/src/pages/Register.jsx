import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";

const STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

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
    <section className="auth">
      <div className="container narrow">
        <h1>Create your account</h1>
        <p className="muted">We will email a 6-digit code to confirm your address.</p>
        <form className="card form" onSubmit={onSubmit} noValidate={false}>
          <div className="grid-2">
            <Field label="First name" id="firstName" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" />
            <Field label="Last name" id="lastName" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />
          </div>
          <Field label="Email" id="email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" inputMode="email" />
          <Field label="Phone number" id="phone" type="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" inputMode="tel" hint="Example: 08012345678" />
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
          <Field label="Password" id="password" type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={72} autoComplete="new-password" hint="At least 8 characters." />
          <FormStatus error={error} slow={slow} />
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="muted center">Already registered? <Link to="/login">Log in</Link></p>
      </div>
    </section>
  );
}
