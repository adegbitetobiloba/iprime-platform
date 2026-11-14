import { useState } from "react";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { PageHead, Pill, splitList, useCall, useTeacher } from "./ui.jsx";

// Your own details. Your role, email and approval status cannot be changed here.
export default function TeacherProfile() {
  const me = useTeacher();
  const call = useCall();
  const p = me.teacherProfile || {};
  const [f, setF] = useState({ phone: me.phone || "", state: me.state || "", subjects: (p.subjects || []).join(", "), qualification: p.qualification || "", yearsExperience: p.yearsExperience ?? "", bio: p.bio || "" });
  const [saved, setSaved] = useState("");
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };

  const save = useSubmit(async () => {
    const subjects = splitList(f.subjects);
    if (!subjects.length) throw new Error("Keep at least one subject you teach.");
    const body = { phone: f.phone.trim(), state: f.state.trim(), subjects, qualification: f.qualification.trim(), bio: f.bio.trim() };
    if (f.yearsExperience !== "") body.yearsExperience = Number(f.yearsExperience);
    await call("/teacher/profile", { method: "PATCH", body });
    setSaved("Saved.");
  });

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title="My profile"><Pill tone="ok">Approved teacher</Pill></PageHead>
      <section className="panel">
        <p><strong>{me.firstName} {me.lastName}</strong><br /><span className="muted">{me.email}</span></p>
        <p className="muted">To change your name or email, contact an administrator.</p>
      </section>
      <form className="panel form" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
        <div className="grid-2">
          <Field label="Phone" id="p-ph" type="tel" value={f.phone} onChange={set("phone")} required />
          <Field label="State" id="p-st" value={f.state} onChange={set("state")} required maxLength={60} />
        </div>
        <Field label="Subjects you teach" id="p-sub" value={f.subjects} onChange={set("subjects")} required hint="Separate with commas." />
        <Field label="Qualification" id="p-q" value={f.qualification} onChange={set("qualification")} required maxLength={200} />
        <Field label="Years of teaching experience" id="p-y" type="number" min="0" max="60" value={f.yearsExperience} onChange={set("yearsExperience")} />
        <Field label="About you" id="p-bio"><textarea id="p-bio" rows="4" maxLength={1000} value={f.bio} onChange={set("bio")} /></Field>
        <FormStatus error={save.error} slow={save.slow} />
        {saved && <p className="note" role="status">{saved}</p>}
        <button className="btn btn-primary" disabled={save.loading}>{save.loading ? "Saving…" : "Save changes"}</button>
      </form>
    </div>
  );
}
