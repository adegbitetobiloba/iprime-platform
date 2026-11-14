import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { Async, Empty, PageHead, StatusPill, useCall } from "./ui.jsx";

// Your tests and mock examinations. You draft them here; an administrator reviews and publishes them.
export default function TeacherExams() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const call = useCall();
  const list = useFetch("/teacher/exams");
  const [open, setOpen] = useState(params.get("new") === "1");
  const [f, setF] = useState({ title: "", subject: "", durationMinutes: "30", level: "", examType: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const create = useSubmit(async () => {
    const mins = Number(f.durationMinutes);
    if (!Number.isInteger(mins) || mins < 1 || mins > 360) throw new Error("Duration must be a whole number of minutes from 1 to 360.");
    const body = { title: f.title.trim(), subject: f.subject.trim(), durationMinutes: mins };
    if (f.level.trim()) body.level = f.level.trim();
    if (f.examType.trim()) body.examType = f.examType.trim();
    const d = await call("/teacher/exams", { method: "POST", body });
    navigate(`/teacher/exams/${d.exam._id || d.exam.id}`);
  });

  return (
    <div className="admin-page">
      <PageHead eyebrow="Teacher area" title="Tests and mock exams">
        <button type="button" className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Close" : "New test"}</button>
      </PageHead>

      {open && (
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); create.run(); }}>
          <h2 className="panel-title">New test or mock exam</h2>
          <Field label="Title" id="x-title" value={f.title} onChange={set("title")} required maxLength={150} />
          <div className="grid-2">
            <Field label="Subject" id="x-subject" value={f.subject} onChange={set("subject")} required maxLength={80} hint="For example: Chemistry. Use the subject's usual name so results group correctly." />
            <Field label="Duration (minutes)" id="x-dur" type="number" min="1" max="360" value={f.durationMinutes} onChange={set("durationMinutes")} required />
          </div>
          <div className="grid-2">
            <Field label="Class or level (optional)" id="x-level" value={f.level} onChange={set("level")} maxLength={60} />
            <Field label="Type (optional)" id="x-type" value={f.examType} onChange={set("examType")} maxLength={60} hint="For example: Mock, Weekly test, Topic quiz." />
          </div>
          <FormStatus error={create.error} slow={create.slow} />
          <button className="btn btn-primary" disabled={create.loading}>{create.loading ? "Creating…" : "Create draft"}</button>
        </form>
      )}

      <Async state={list}>
        {list.data && list.data.exams.length === 0 ? <Empty>No tests yet. Create one, add questions, then send it for review.</Empty> : (
          <ul className="tch-list">
            {(list.data?.exams || []).map((e) => (
              <li key={e.id} className="tch-row">
                <div>
                  <strong>{e.title}</strong>
                  <small>{e.subject} · {e.durationMinutes} min · {e.questionCount} question{e.questionCount === 1 ? "" : "s"}</small>
                  {e.review && e.review.status === "returned" && e.review.note && <div className="tch-note">Returned: {e.review.note}</div>}
                </div>
                <div className="tch-actions"><StatusPill status={e.status} review={e.review} /><Link className="btn btn-secondary" to={`/teacher/exams/${e.id}`}>Open</Link></div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
