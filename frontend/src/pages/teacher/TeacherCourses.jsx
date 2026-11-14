import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { Async, Empty, PageHead, StatusPill, useCall } from "./ui.jsx";

// Your courses. A course is built from chapters and lessons, saved as a draft, and sent to an administrator for review.
export default function TeacherCourses() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const call = useCall();
  const list = useFetch("/teacher/courses");
  const subjects = useFetch("/teacher/library/subjects");
  const [open, setOpen] = useState(params.get("new") === "1");
  const [f, setF] = useState({ title: "", subject: "", description: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const create = useSubmit(async () => {
    const d = await call("/teacher/courses", { method: "POST", body: { title: f.title.trim(), subject: f.subject, description: f.description.trim() } });
    navigate(`/teacher/courses/${d.course._id || d.course.id}`);
  });

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title="Courses">
        <button type="button" className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Close" : "New course"}</button>
      </PageHead>

      {open && (
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
          <h2 className="panel-title">New course</h2>
          <Field label="Title" id="c-title" value={f.title} onChange={set("title")} required minLength={3} maxLength={150} />
          <Field label="Subject" id="c-subject"><select id="c-subject" value={f.subject} onChange={set("subject")} required><option value="">Choose a subject</option>{(subjects.data?.subjects || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
          <Field label="What is it about?" id="c-desc" hint="Required before you can send the course for review."><textarea id="c-desc" rows="3" value={f.description} onChange={set("description")} maxLength={3000} /></Field>
          <FormStatus error={create.error} slow={create.slow} />
          <button className="btn btn-primary" disabled={create.loading}>{create.loading ? "Creating…" : "Create draft course"}</button>
        </form>
      )}

      <Async state={list}>
        {list.data && list.data.courses.length === 0 ? <Empty>No courses yet. Create one, add chapters and lessons, then send it for review.</Empty> : (
          <ul className="tch-list">
            {(list.data?.courses || []).map((c) => (
              <li key={c.id} className="tch-row">
                <div>
                  <strong>{c.title}</strong>
                  <small>{c.subject ? `${c.subject.name} · ` : ""}{c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}</small>
                  {c.review && c.review.status === "returned" && c.review.note && <div className="tch-note">Returned: {c.review.note}</div>}
                </div>
                <div className="tch-actions"><StatusPill status={c.status} review={c.review} /><Link className="btn btn-secondary" to={`/teacher/courses/${c.id}`}>Open</Link></div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
