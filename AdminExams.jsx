import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";

export default function AdminExams() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch("/admin/exams");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", level: "", examType: "", durationMinutes: "30", maxAttempts: "1" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = useSubmit(async () => {
    const d = await api("/admin/exams", {
      method: "POST", token,
      body: { ...form, durationMinutes: Number(form.durationMinutes), maxAttempts: Number(form.maxAttempts) },
    });
    navigate(`/admin/exams/${d.exam._id}`);
    return d;
  });

  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>Examinations</h1></div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Close" : "New examination"}</button>
      </div>

      {open && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
          <h2 className="panel-title">New examination (saved as a draft)</h2>
          <Field label="Title" id="x-title" value={form.title} onChange={set("title")} required maxLength={150} />
          <div className="grid-2">
            <Field label="Subject" id="x-subject" value={form.subject} onChange={set("subject")} required maxLength={80} />
            <Field label="Class or level (optional)" id="x-level" value={form.level} onChange={set("level")} maxLength={60} hint="For example: SS 3" />
          </div>
          <div className="grid-2">
            <Field label="Examination type (optional)" id="x-type" value={form.examType} onChange={set("examType")} maxLength={60} hint="For example: Practice test" />
            <Field label="Duration (minutes)" id="x-duration" type="number" min="1" max="360" value={form.durationMinutes} onChange={set("durationMinutes")} required />
          </div>
          <Field label="Attempts allowed per student" id="x-attempts" type="number" min="1" max="20" value={form.maxAttempts} onChange={set("maxAttempts")} required />
          <FormStatus error={create.error} slow={create.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={create.loading} aria-busy={create.loading}>{create.loading ? "Creating..." : "Create and add questions"}</button>
          </div>
        </form>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && data.exams.length === 0 && <p className="note">No examinations yet. Create the first one above.</p>}
      {data && data.exams.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Title</th><th>Status</th><th>Questions</th><th>Duration</th><th>Attempts</th><th>Updated</th></tr></thead>
            <tbody>
              {data.exams.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/admin/exams/${e.id}`}><strong>{e.title}</strong></Link><br /><span className="muted">{e.subject}{e.level ? ` · ${e.level}` : ""}</span></td>
                  <td><span className={`badge ${e.status === "published" ? "badge-ok" : "badge-quiet"}`}>{e.status === "published" ? "Published" : "Draft"}</span></td>
                  <td>{e.questionCount}</td>
                  <td>{e.durationMinutes} min</td>
                  <td>{e.attempts}</td>
                  <td>{fmtDate(e.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
