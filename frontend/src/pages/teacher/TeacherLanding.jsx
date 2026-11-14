import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { api } from "../../api.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";

const blank = { firstName: "", lastName: "", email: "", phone: "", state: "", password: "", confirm: "", subjects: "", qualification: "", yearsExperience: "", bio: "" };
const splitList = (s) => [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];

// /teacher: what the teacher area is, and how to apply. A new teacher account stays "pending" until an administrator approves it.
export default function TeacherLanding() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [step, setStep] = useState(params.get("verify") ? "verify" : "form"); // form -> verify -> done
  const [f, setF] = useState({ ...blank, email: params.get("verify") || "" });
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const apply = useSubmit(async () => {
    setInfo("");
    if (f.password !== f.confirm) throw new Error("The two passwords are not the same.");
    const subjects = splitList(f.subjects);
    if (!subjects.length) throw new Error("Tell us at least one subject you teach.");
    const body = {
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(), state: f.state.trim(),
      password: f.password, subjects, qualification: f.qualification.trim(),
      ...(f.yearsExperience !== "" ? { yearsExperience: Number(f.yearsExperience) } : {}),
      ...(f.bio.trim() ? { bio: f.bio.trim() } : {}),
    };
    try {
      await api("/teacher/auth/apply", { method: "POST", body });
      setStep("verify");
    } catch (e) {
      if (e.code === "EMAIL_FAILED") { setInfo(e.message); setStep("verify"); return; } // saved, but the code email failed: they can resend
      throw e;
    }
  });

  const verify = useSubmit(async () => {
    await api("/teacher/auth/verify-otp", { method: "POST", body: { email: f.email.trim(), otp: code.trim() } });
    setStep("done");
  });

  const resend = useSubmit(async () => {
    const d = await api("/teacher/auth/resend-otp", { method: "POST", body: { email: f.email.trim() } });
    setInfo(d.message);
  });

  if (user && user.role === "teacher") return <Navigate to="/teacher/dashboard" replace />;

  return (
    <div className="container" style={{ maxWidth: "46rem" }}>
      <section className="tch-hero">
        <p className="eyebrow">Teacher area</p>
        <h1>Teach with iPrime</h1>
        <p>For tutors at Prime Excelerate Tutelage: see how your students are doing, build notes, courses and practice tests, and send them for review.</p>
        <ol className="tch-steps">
          <li><span><strong>Apply</strong> with your details and the subjects you teach.</span></li>
          <li><span><strong>Verify</strong> your email with the code we send.</span></li>
          <li><span><strong>Wait for approval.</strong> An administrator reviews every application. You cannot sign in until then.</span></li>
        </ol>
        <p style={{ marginTop: "1rem" }}>Already approved? <Link to="/teacher/login">Teacher sign in</Link></p>
      </section>

      {step === "form" && (
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); apply.run(); }} noValidate>
          <h2 className="panel-title">Apply for a teacher account</h2>
          <div className="grid-2">
            <Field label="First name" id="a-fn" value={f.firstName} onChange={set("firstName")} required maxLength={60} autoComplete="given-name" />
            <Field label="Last name" id="a-ln" value={f.lastName} onChange={set("lastName")} required maxLength={60} autoComplete="family-name" />
          </div>
          <Field label="Email" id="a-em" type="email" value={f.email} onChange={set("email")} required autoComplete="email" hint="We send a verification code here." />
          <div className="grid-2">
            <Field label="Phone" id="a-ph" type="tel" value={f.phone} onChange={set("phone")} required autoComplete="tel" />
            <Field label="State" id="a-st" value={f.state} onChange={set("state")} required maxLength={60} autoComplete="address-level1" />
          </div>
          <Field label="Subjects you teach" id="a-sub" value={f.subjects} onChange={set("subjects")} required hint="Separate with commas, for example: Chemistry, Biology." />
          <Field label="Qualification" id="a-q" value={f.qualification} onChange={set("qualification")} required maxLength={200} hint="For example: B.Sc Chemistry, University of Ibadan." />
          <Field label="Years of teaching experience (optional)" id="a-y" type="number" min="0" max="60" value={f.yearsExperience} onChange={set("yearsExperience")} />
          <Field label="About you (optional)" id="a-bio" hint="A few sentences. Administrators read this when they review your application."><textarea id="a-bio" rows="3" maxLength={1000} value={f.bio} onChange={set("bio")} /></Field>
          <div className="grid-2">
            <Field label="Password" id="a-pw" type="password" value={f.password} onChange={set("password")} required autoComplete="new-password" hint="At least 8 characters." minLength={8} maxLength={72} />
            <Field label="Confirm password" id="a-pw2" type="password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />
          </div>
          <FormStatus error={apply.error} slow={apply.slow} />
          <button className="btn btn-primary" disabled={apply.loading}>{apply.loading ? "Sending…" : "Send application"}</button>
        </form>
      )}

      {step === "verify" && (
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); verify.run(); }} noValidate>
          <h2 className="panel-title">Verify your email</h2>
          <p>Enter the 6-digit code sent to <strong>{f.email || "your email"}</strong>.</p>
          {info && <div className="alert alert-info" role="status">{info}</div>}
          {!f.email && <Field label="Email" id="v-em" type="email" value={f.email} onChange={set("email")} required />}
          <Field label="Code" id="v-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required maxLength={6} />
          <FormStatus error={verify.error || resend.error} slow={verify.slow} />
          <div className="tch-actions">
            <button className="btn btn-primary" disabled={verify.loading || code.length !== 6}>{verify.loading ? "Checking…" : "Verify"}</button>
            <button type="button" className="btn btn-secondary" disabled={resend.loading || !f.email} onClick={() => resend.run()}>Send a new code</button>
          </div>
        </form>
      )}

      {step === "done" && (
        <section className="panel" role="status">
          <h2 className="panel-title">Application received</h2>
          <p>Your email is verified. An administrator will review your application and email you at <strong>{f.email}</strong> when it is approved. You can sign in after that.</p>
          <Link className="btn btn-secondary" to="/teacher/login">Go to teacher sign in</Link>
        </section>
      )}
    </div>
  );
}
