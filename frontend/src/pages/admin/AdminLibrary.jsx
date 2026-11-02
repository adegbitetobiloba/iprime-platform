import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import CourseForm, { blankCourse, courseBody } from "../../library/CourseForm.jsx";
import "../../library/library.css";

const STATUS_LABEL = { draft: "Draft", review: "Under review", published: "Published", archived: "Archived" };
const badge = (s) => (s === "published" ? "badge-ok" : "badge-quiet");

export default function AdminLibrary() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const courses = useFetch("/admin/library/courses");
  const subjects = useFetch("/admin/library/subjects");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankCourse);
  const [subName, setSubName] = useState("");
  const [subGroup, setSubGroup] = useState("subject");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const subs = subjects.data ? subjects.data.subjects : [];

  const create = useSubmit(async () => {
    const r = await api("/admin/library/courses", { method: "POST", token, body: courseBody(form) });
    navigate(`/admin/library/courses/${r.course._id}`);
  });

  const addSubject = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try { await api("/admin/library/subjects", { method: "POST", token, body: { name: subName, group: subGroup } }); setSubName(""); setMsg("Subject added."); subjects.reload(); } catch (x) { setErr(x.message); }
  };
  const toggleSubject = async (s) => {
    setErr(""); setMsg("");
    try { await api(`/admin/library/subjects/${s._id}`, { method: "PATCH", token, body: { status: s.status === "active" ? "archived" : "active" } }); subjects.reload(); } catch (x) { setErr(x.message); }
  };

  const list = courses.data ? courses.data.courses : [];
  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>Library</h1></div>
        <div className="form-actions">
          <Link to="/admin/library/analytics" className="btn btn-secondary">Learning analytics</Link>
          {!creating && <button type="button" className="btn btn-primary" onClick={() => { setCreating(true); setForm(blankCourse); }} disabled={!subs.some((s) => s.status === "active")}>New course</button>}
        </div>
      </div>
      <p className="muted">Courses are hidden from students until you publish them. Add a subject first if the list below is empty.</p>
      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}

      {creating && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
          <h2 className="panel-title">New course</h2>
          <CourseForm form={form} setForm={setForm} subjects={subs} />
          <FormStatus error={create.error} slow={create.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={create.loading} aria-busy={create.loading}>{create.loading ? "Creating..." : "Create course"}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setCreating(false)} disabled={create.loading}>Cancel</button>
          </div>
        </form>
      )}

      <div className="lib-admin-grid two" style={{ marginTop: 18 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Courses</h2>
          {courses.error && <p className="alert alert-error" role="alert">{courses.error}</p>}
          {courses.loading && <div className="exam-card skeleton" aria-hidden="true" />}
          {courses.data && list.length === 0 && <p className="note">No courses yet.</p>}
          {list.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Course</th><th>Status</th><th>Lessons</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c._id}>
                      <td><Link to={`/admin/library/courses/${c._id}`}><strong>{c.title}</strong></Link><br /><span className="muted">{c.subject ? c.subject.name : ""}{c.featured ? " · Featured" : ""}</span></td>
                      <td><span className={`badge ${badge(c.status)}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td>{c.lessonCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Subjects and exam groups</h2>
          <form className="panel form form-tight" onSubmit={addSubject}>
            <Field label="Name" id="s-name" value={subName} onChange={(e) => setSubName(e.target.value)} required maxLength={80} hint="For example: Chemistry, or JAMB" />
            <Field label="Type" id="s-group">
              <select id="s-group" value={subGroup} onChange={(e) => setSubGroup(e.target.value)}><option value="subject">Subject</option><option value="exam-prep">Exam preparation</option></select>
            </Field>
            <button className="btn btn-primary" type="submit">Add</button>
          </form>
          <ul className="lib-outline" style={{ marginTop: 12 }}>
            {subs.map((s) => (
              <li key={s._id} className="lib-lesson-row">
                <span className="grow">{s.name} <span className="muted">({s.group === "exam-prep" ? "exam group" : "subject"})</span></span>
                <span className={`badge ${s.status === "active" ? "badge-ok" : "badge-quiet"}`}>{s.status === "active" ? "Active" : "Archived"}</span>
                <button type="button" className="link-btn" onClick={() => toggleSubject(s)}>{s.status === "active" ? "Archive" : "Restore"}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
