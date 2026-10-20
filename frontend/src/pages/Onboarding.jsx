import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import TypeCards from "../components/TypeCards.jsx";

// For a brand-new person who signed in with Google: Google has told us who they are; we only ask what kind of account to open.
export default function Onboarding() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { acceptSession, setNotice } = useAuth();
  const [type, setType] = useState("student");
  const [graduationYear, setGraduationYear] = useState("");
  const [lastClass, setLastClass] = useState("");

  const finish = useSubmit(async () => {
    const body = { setupToken: state.setupToken, role: type };
    if (type === "alumni") {
      if (graduationYear) body.graduationYear = Number(graduationYear);
      if (lastClass.trim()) body.lastClass = lastClass.trim();
    }
    const d = await api("/auth/google/complete", { method: "POST", body });
    if (d.status === "pending_approval") { navigate("/pending-approval", { state: { email: d.email, kind: "pending", justRegistered: true } }); return d; }
    acceptSession(d.token, d.user);
    setNotice({ kind: "ok", text: "Your account is ready." });
    navigate("/dashboard");
    return d;
  });

  if (!state?.setupToken) return <Navigate to="/login" replace />; // this page only makes sense straight after Google

  return (
    <AuthLayout title={`Welcome, ${state.profile?.firstName || "there"}`} subtitle="One last step: how will you use iPrime?">
      <p className="onboard-email">Signed in with Google as <strong>{state.profile?.email}</strong></p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); finish.run(); }}>
        <TypeCards value={type} onChange={setType} name="onboarding-type" />
        {type === "alumni" && (
          <>
            <div className="grid-2">
              <Field label="Year you finished (optional)" id="ob-year" type="number" min="1950" max={new Date().getFullYear() + 1} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} inputMode="numeric" />
              <Field label="Last class (optional)" id="ob-class" value={lastClass} onChange={(e) => setLastClass(e.target.value)} maxLength={60} />
            </div>
            <p className="hint">Alumni accounts are confirmed by the institution. Until then, your account does not give access to any student records.</p>
          </>
        )}
        <FormStatus error={finish.error} slow={finish.slow} />
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={finish.loading} aria-busy={finish.loading}>
          {finish.loading ? "Creating your account..." : "Create my account"}
        </button>
        <p className="hint center">You can add your phone number and state later in your profile.</p>
      </form>
    </AuthLayout>
  );
}
