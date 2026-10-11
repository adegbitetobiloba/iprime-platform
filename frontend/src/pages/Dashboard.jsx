import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useSubmit } from "../useSubmit.js";
import { STATES } from "../states.js";
import Icon from "../components/Icon.jsx";
import Field from "../components/Field.jsx";
import FormStatus from "../components/FormStatus.jsx";
import Reveal from "../components/Reveal.jsx";

const ROLE_LABEL = { student: "Student", parent: "Parent or guardian", teacher: "Teacher", admin: "Administrator" };

const UPCOMING = [
  { icon: "book", title: "Learning library", text: "Study resources by subject and topic will appear here." },
  { icon: "test", title: "CBT practice", text: "Practice examinations will be available here when released." },
  { icon: "chart", title: "Results and progress", text: "Your test history and progress will be shown here." },
];

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
};

const toForm = (u) => ({
  firstName: u.firstName || "",
  lastName: u.lastName || "",
  otherNames: u.otherNames || "",
  phone: u.phone || "",
  state: u.state || "",
  dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : "",
});

function AccountPanel({ user }) {
  const { token, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(user));
  const [saved, setSaved] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // The server's response (not our local form) becomes the displayed profile, so the screen always shows what was really saved.
  const save = useSubmit(async () => {
    const data = await api("/auth/me", { method: "PATCH", token, body: form });
    updateUser(data.user);
    return data;
  });

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(""), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  const startEdit = () => { setForm(toForm(user)); setSaved(""); save.setError(""); setEditing(true); };
  const cancel = () => { save.setError(""); setEditing(false); };
  const onSubmit = async (e) => {
    e.preventDefault();
    const r = await save.run();
    if (!r?.failed) { setEditing(false); setSaved("Your profile has been updated."); }
  };

  const joined = formatDate(user.createdAt);
  const details = [
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ")],
    ...(user.studentId ? [["Student ID", user.studentId]] : []),
    ...(user.otherNames ? [["Other names", user.otherNames]] : []),
    ["Email", user.email],
    ["Phone", user.phone],
    ["State", user.state],
    ...(user.dob ? [["Date of birth", formatDate(user.dob)]] : []),
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
          <FormStatus error={save.error} slow={save.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>
              {save.loading ? "Saving..." : "Save changes"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={cancel} disabled={save.loading}>Cancel</button>
          </div>
        </form>
      ) : (
        <dl className="details">
          {details.map(([k, v]) => (
            <div key={k} className="details-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return <p className="page-note" role="status">Loading your account...</p>;

  return (
    <section className="section dash">
      <div className="container">
        <div className="dash-banner reveal">
          <div>
            <p className="pill pill-on-dark">{ROLE_LABEL[user.role] || user.role}</p>
            <h1>Welcome, {user.firstName}</h1>
            <p>Your account is active. Features appear here as they are released.</p>
          </div>
          {user.isVerified && <span className="status-ok"><Icon name="check" size={16} /> Email verified</span>}
        </div>

        <div className="dash-grid">
          <div className="reveal reveal-2"><AccountPanel user={user} /></div>

          <Reveal delay={120}>
            <div className="panel">
              <h2 className="panel-title">Coming next</h2>
              <ul className="upcoming">
                {UPCOMING.map((u) => (
                  <li key={u.title} className="upcoming-item">
                    <span className="icon-tile icon-tile-sm"><Icon name={u.icon} size={18} /></span>
                    <div>
                      <p className="upcoming-title">{u.title} <span className="badge">In development</span></p>
                      <p className="upcoming-text">{u.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
