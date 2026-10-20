import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import GoogleLinkPanel from "../components/GoogleLinkPanel.jsx";
import TypeCards from "../components/TypeCards.jsx";
import { ACCOUNT_TYPES } from "../accountTypes.js";
import { STATES } from "../states.js";

// Two short steps: who you are, then your details. Google can be used from step 1 (nothing more to fill in there).
export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wanted = params.get("type");
  const [type, setType] = useState(ACCOUNT_TYPES.some((t) => t.id === wanted) ? wanted : "student");
  const [step, setStep] = useState(1);
  const [link, setLink] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", state: "", password: "", graduationYear: "", lastClass: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { run, loading, slow, error } = useSubmit(() => {
    const body = { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, state: form.state, password: form.password, role: type, country: "Nigeria" };
    if (type === "alumni") {
      if (form.graduationYear) body.graduationYear = Number(form.graduationYear);
      if (form.lastClass.trim()) body.lastClass = form.lastClass.trim();
    }
    return api("/auth/register", { method: "POST", body });
  });

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

  if (link) {
    return (
      <AuthLayout title="We found your iPrime account" subtitle="Connect Google to it in one quick step.">
        <GoogleLinkPanel info={link} onDone={() => navigate("/dashboard")} onCancel={() => setLink(null)} onPending={(d) => navigate("/pending-approval", { state: { email: d.email, kind: "pending" } })} />
      </AuthLayout>
    );
  }

  const thisYear = new Date().getFullYear();
  const footer = <>Already registered? <Link to="/login">Log in</Link></>;

  if (step === 1) {
    return (
      <AuthLayout title="Create your account" subtitle="First, tell us how you will use iPrime." footer={footer}>
        <ol className="stepper" aria-label="Progress">
          <li aria-current="step"><span>1</span> Account type</li>
          <li><span>2</span> Your details</li>
        </ol>
        <div className="form">
          <TypeCards value={type} onChange={setType} />
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setStep(2)}>Continue with email</button>
          <p className="auth-divider"><span>or</span></p>
          <GoogleButton
            role={type}
            onSignedIn={() => navigate("/dashboard")}
            onLinkRequired={setLink}
        onPending={(d) => navigate("/pending-approval", { state: { email: d.email, kind: "pending" } })}
            onOnboarding={(d) => navigate("/onboarding", { state: { setupToken: d.setupToken, profile: d.profile } })}
          />
          <p className="hint center">With Google there is no form to fill in. You can add your phone number later.</p>
        </div>
      </AuthLayout>
    );
  }

  const label = ACCOUNT_TYPES.find((t) => t.id === type)?.title;
  return (
    <AuthLayout title="Your details" subtitle={<>Registering as: <strong>{label}</strong>. We will email a 6-digit code to confirm your address.</>} footer={footer}>
      <ol className="stepper" aria-label="Progress">
        <li><span>1</span> Account type</li>
        <li aria-current="step"><span>2</span> Your details</li>
      </ol>
      <button type="button" className="link-btn back-link" onClick={() => setStep(1)}>← Change account type</button>
      <form className="form" onSubmit={onSubmit}>
        <div className="grid-2">
          <Field label="First name" id="firstName" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" />
          <Field label="Last name" id="lastName" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />
        </div>
        <Field label="Email" id="email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" inputMode="email" />
        <Field label="Phone number" id="phone" type="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" inputMode="tel" hint="The institution uses this to contact you about your account. Example: 08012345678" />
        <Field label="State" id="state" hint="Where you are based.">
          <select id="state" value={form.state} onChange={set("state")} required>
            <option value="">Select your state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        {type === "alumni" && (
          <div className="grid-2">
            <Field label="Year you finished (optional)" id="graduationYear" type="number" min="1950" max={thisYear + 1} value={form.graduationYear} onChange={set("graduationYear")} inputMode="numeric" />
            <Field label="Last class (optional)" id="lastClass" value={form.lastClass} onChange={set("lastClass")} maxLength={60} />
          </div>
        )}
        {type === "alumni" && <p className="hint">Alumni accounts are confirmed by the institution after sign-up. Until then, your account does not give access to any student records.</p>}
        <Field label="Password" id="password" type="password" value={form.password} onChange={set("password")} required minLength={8} maxLength={72} autoComplete="new-password" hint="At least 8 characters." />
        <FormStatus error={error} slow={slow} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
