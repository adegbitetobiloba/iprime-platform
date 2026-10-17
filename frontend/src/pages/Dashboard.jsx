import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import { STATES } from "../states.js";
import { TYPE_LABEL, ALUMNI_STATUS } from "../accountTypes.js";
import Icon from "../components/Icon.jsx";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import Reveal from "../components/Reveal.jsx";
import GoogleButton from "../components/GoogleButton.jsx";

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
};

const toForm = (u) => ({
  firstName: u.firstName || "", lastName: u.lastName || "", otherNames: u.otherNames || "", phone: u.phone || "", state: u.state || "",
  dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : "",
  graduationYear: u.alumni?.graduationYear ? String(u.alumni.graduationYear) : "", lastClass: u.alumni?.lastClass || "",
});

function AccountPanel({ user }) {
  const { token, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(user));
  const [saved, setSaved] = useState("");
  const [leaving, setLeaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isAlumni = user.role === "alumni";

  // The server's reply (not our local form) becomes the displayed profile, so the screen always shows what was really saved.
  const save = useSubmit(async () => {
    const body = { firstName: form.firstName, lastName: form.lastName, otherNames: form.otherNames, phone: form.phone, state: form.state, dob: form.dob };
    if (isAlumni) {
      if (form.graduationYear) body.graduationYear = Number(form.graduationYear);
      body.lastClass = form.lastClass.trim();
    }
    const data = await api("/auth/me", { method: "PATCH", token, body });
    updateUser(data.user);
    return data;
  });

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(""), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  const startEdit = () => { setForm(toForm(user)); setSaved(""); save.setError(""); setEditing(true); };
  const onSubmit = async (e) => {
    e.preventDefault();
    const r = await save.run();
    if (!r?.failed) { setEditing(false); setSaved("Your profile has been updated."); }
  };
  const doLogout = async () => { setLeaving(true); await logout(); navigate("/"); };

  const joined = formatDate(user.createdAt);
  const details = [
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ")],
    ["Account type", TYPE_LABEL[user.role] || user.role],
    ...(user.studentId ? [["Student ID", user.studentId]] : []),
    ...(user.otherNames ? [["Other names", user.otherNames]] : []),
    ["Email", `${user.email}${user.isVerified ? " (verified)" : ""}`],
    ["Phone", user.phone || "Not added yet"],
    ["State", user.state || "Not added yet"],
    ...(user.dob ? [["Date of birth", formatDate(user.dob)]] : []),
    ...(isAlumni ? [["Year finished", user.alumni?.graduationYear || "Not added"], ["Last class", user.alumni?.lastClass || "Not added"]] : []),
    ...(joined ? [["Member since", joined]] : []),
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Your account</h2>
        {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={startEdit}>Edit profile</button>}
      </div>

      {saved && <p className="alert alert-success" role="status">{saved}</p>}

      {editing ? (
        <form className="form form-tight" onSubmit={onSubmit}>
          <div className="grid-2">
            <Field label="First name" id="p-firstName" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" autoFocus />
            <Field label="Last name" id="p-lastName" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />
          </div>
          <Field label="Other names (optional)" id="p-otherNames" value={form.otherNames} onChange={set("otherNames")} autoComplete="additional-name" />
          <Field label="Email" id="p-email" value={user.email} readOnly hint="Your email address cannot be changed here." />
          <Field label="Phone number" id="p-phone" type="tel" value={form.phone} onChange={set("phone")} required autoComplete="tel" inputMode="tel" hint="Example: 08012345678" />
          <div className="grid-2">
            <Field label="State" id="p-state">
              <select id="p-state" value={form.state} onChange={set("state")} required>
                <option value="">Select your state</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                {form.state && !STATES.includes(form.state) && <option value={form.state}>{form.state}</option>}
              </select>
            </Field>
            <Field label="Date of birth (optional)" id="p-dob" type="date" value={form.dob} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" />
          </div>
          {isAlumni && (
            <div className="grid-2">
              <Field label="Year you finished" id="p-year" type="number" min="1950" max={new Date().getFullYear() + 1} value={form.graduationYear} onChange={set("graduationYear")} inputMode="numeric" />
              <Field label="Last class" id="p-class" value={form.lastClass} onChange={set("lastClass")} maxLength={60} />
            </div>
          )}
          <FormStatus error={save.error} slow={save.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>{save.loading ? "Saving..." : "Save changes"}</button>
            <button className="btn btn-secondary" type="button" onClick={() => { save.setError(""); setEditing(false); }} disabled={save.loading}>Cancel</button>
          </div>
        </form>
      ) : (
        <dl className="details">
          {details.map(([k, v]) => (<div key={k} className="details-row"><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      )}

      {!editing && (
        <div className="google-link">
          <h3>Google sign-in</h3>
          {user.googleLinked ? (
            <p className="status-ok"><Icon name="check" size={16} /> Google account linked</p>
          ) : user.hasPassword ? (
            <>
              <p className="muted">Link your Google account to sign in with one tap. It must use the same email address as this account ({user.email}).</p>
              <GoogleButton mode="link" />
            </>
          ) : null}
        </div>
      )}

      {!editing && (
        <div className="account-actions">
          <button type="button" className="btn btn-danger-outline" onClick={doLogout} disabled={leaving} aria-busy={leaving}>{leaving ? "Logging out..." : "Log out"}</button>
        </div>
      )}
    </div>
  );
}

function AlumniPanel({ user }) {
  const { token, updateUser } = useAuth();
  const [note, setNote] = useState(user.alumni?.note || "");
  const status = user.alumniStatus || "unverified";
  const request = useSubmit(async () => {
    const d = await api("/auth/alumni/request-verification", { method: "POST", token, body: { note } });
    updateUser(d.user);
    return d;
  });
  const canRequest = status === "unverified" || status === "rejected";
  return (
    <div className="panel">
      <h2 className="panel-title">Alumni status</h2>
      <p className={`badge ${status === "verified" ? "badge-ok" : status === "rejected" ? "badge-bad" : "badge-quiet"}`}>{ALUMNI_STATUS[status] || status}</p>
      {status === "verified" && <p className="muted">The institution has confirmed that you studied with Prime Excelerate Tutelage.</p>}
      {status === "pending" && <p className="muted">Your request is with the institution. You will see the result here.</p>}
      {status === "rejected" && <p className="muted">The institution could not confirm your details. You can update your profile and ask again.</p>}
      {canRequest && (
        <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); request.run(); }}>
          <p className="muted">Ask the institution to confirm that you studied with them. Until it does, this account gives no access to student records.</p>
          <Field label="Anything that helps them find you (optional)" id="alumni-note"><textarea id="alumni-note" rows="3" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <FormStatus error={request.error} slow={request.slow} />
          <button className="btn btn-primary" type="submit" disabled={request.loading} aria-busy={request.loading}>{request.loading ? "Sending..." : "Request verification"}</button>
        </form>
      )}
      <p className="note">Keep your profile up to date so the institution can reach you. More alumni features will be announced here.</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return <p className="page-note" role="status">Loading your account...</p>;
  const exams = user.role === "student" || user.role === "admin";

  return (
    <section className="section dash">
      <div className="container">
        <div className="dash-banner reveal">
          <div>
            <p className="pill pill-on-dark">{TYPE_LABEL[user.role] || user.role}</p>
            <h1>Welcome, {user.firstName}</h1>
            <p>{user.role === "alumni" ? "Your alumni account is active." : "Your account is active."}</p>
          </div>
          {user.isVerified && <span className="status-ok"><Icon name="check" size={16} /> Email verified</span>}
        </div>

        {(!user.phone || !user.state) && user.role !== "admin" && (
          <p className="alert alert-info" role="status" style={{ marginBottom: "var(--s4)" }}>
            Welcome! Add your phone number and state to finish setting up your profile. Use <strong>Edit profile</strong> below.
          </p>
        )}

        <div className="dash-grid">
          <div className="reveal reveal-2"><AccountPanel user={user} /></div>

          <Reveal delay={120}>
            <div className="stack">
              {exams && (
                <div className="panel">
                  <h2 className="panel-title">Examinations</h2>
                  <p className="muted">Take the examinations published for you and review your results.</p>
                  <div className="form-actions">
                    <Link to="/exams" className="btn btn-primary">Examination centre</Link>
                    <Link to="/results" className="btn btn-secondary">My results</Link>
                  </div>
                </div>
              )}
              {user.role === "admin" && (
                <div className="panel">
                  <h2 className="panel-title">Administration</h2>
                  <Link to="/admin" className="btn btn-secondary">Open administration</Link>
                </div>
              )}
              {user.role === "parent" && (
                <div className="panel">
                  <h2 className="panel-title">Linked students</h2>
                  <p className="note">Linking a student to your account is not available yet. When it is, it will use a secure approval process, and your child's results will appear here. Nothing is shown until a link has been approved.</p>
                </div>
              )}
              {user.role === "alumni" && <AlumniPanel user={user} />}
              {user.role === "student" && (
                <div className="panel">
                  <h2 className="panel-title">On the way</h2>
                  <ul className="plain-list">
                    <li><strong>Learning library</strong>: study resources by subject and topic.</li>
                    <li><strong>Progress insights</strong>: trends across your results over time.</li>
                  </ul>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
