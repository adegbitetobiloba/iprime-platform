import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { ActError, PageHead, StatusPill, uploadFile, useAct, useCall } from "./ui.jsx";

const TYPES = [["text", "Written lesson"], ["video", "Video (YouTube or Vimeo)"], ["pdf", "PDF document"], ["link", "Web link"]];
const LEVELS = [["", "Not set"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]];
const hasContent = (l) => (l.contentType === "text" ? !!(l.body && l.body.trim()) : l.contentType === "video" ? !!(l.video && l.video.videoId) : l.contentType === "pdf" ? !!(l.pdf && l.pdf.file) : !!l.externalUrl);

// One lesson: shows its state, and edits it in place (only while the course is an unlocked draft).
function Lesson({ lesson, editable, call, token, onChange }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: lesson.title, body: lesson.body || "", videoUrl: lesson.video ? lesson.video.url : "", externalUrl: lesson.externalUrl || "", estimatedMinutes: lesson.estimatedMinutes ?? "" });
  const act = useAct();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => act.run(async () => {
    const body = { title: f.title.trim() };
    if (lesson.contentType === "text") body.body = f.body;
    if (lesson.contentType === "video") body.videoUrl = f.videoUrl.trim();
    if (lesson.contentType === "link") body.externalUrl = f.externalUrl.trim();
    if (f.estimatedMinutes !== "") body.estimatedMinutes = Number(f.estimatedMinutes);
    await call(`/teacher/courses/lessons/${lesson._id}`, { method: "PATCH", body });
    setOpen(false);
    await onChange();
  });
  return (
    <div className="tch-lesson">
      <div className="tch-actions" style={{ justifyContent: "space-between" }}>
        <div><strong>{lesson.title}</strong> <small className="muted">{TYPES.find((t) => t[0] === lesson.contentType)?.[1]}</small> {!hasContent(lesson) && <span className="tch-pill tch-warn">No content yet</span>}</div>
        {editable && (
          <div className="tch-actions">
            <button type="button" className="btn btn-secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</button>
            <button type="button" className="link-btn link-danger" disabled={act.busy} onClick={() => { if (window.confirm(`Delete the lesson "${lesson.title}"?`)) act.run(async () => { await call(`/teacher/courses/lessons/${lesson._id}`, { method: "DELETE" }); await onChange(); }); }}>Delete</button>
          </div>
        )}
      </div>
      {open && editable && (
        <div className="form form-tight" style={{ marginTop: ".6rem" }}>
          <Field label="Lesson title" id={`l-t-${lesson._id}`} value={f.title} onChange={set("title")} maxLength={150} />
          {lesson.contentType === "text" && <Field label="Lesson text" id={`l-b-${lesson._id}`}><textarea id={`l-b-${lesson._id}`} className="tch-textarea" value={f.body} onChange={set("body")} maxLength={60000} /></Field>}
          {lesson.contentType === "video" && <Field label="Video link" id={`l-v-${lesson._id}`} value={f.videoUrl} onChange={set("videoUrl")} hint="A https YouTube or Vimeo link." />}
          {lesson.contentType === "link" && <Field label="Web link (https)" id={`l-x-${lesson._id}`} value={f.externalUrl} onChange={set("externalUrl")} />}
          {lesson.contentType === "pdf" && (
            <Field label={lesson.pdf && lesson.pdf.file ? `PDF attached (${lesson.pdf.originalName || "file"}). Choose another to replace it.` : "PDF file (up to 20 MB)"} id={`l-p-${lesson._id}`}>
              <input id={`l-p-${lesson._id}`} type="file" accept="application/pdf" disabled={act.busy} onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ""; if (file) act.run(async () => { await uploadFile(`/teacher/courses/lessons/${lesson._id}/pdf`, file, token); await onChange(); }); }} />
            </Field>
          )}
          <Field label="Minutes (optional)" id={`l-m-${lesson._id}`} type="number" min="0" max="1000" value={f.estimatedMinutes} onChange={set("estimatedMinutes")} />
          <button type="button" className="btn btn-primary" disabled={act.busy} onClick={save}>{act.busy ? "Saving…" : "Save lesson"}</button>
        </div>
      )}
      <ActError act={act} />
    </div>
  );
}

function AddLesson({ moduleId, call, onChange }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", contentType: "text", body: "", videoUrl: "", externalUrl: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const add = useSubmit(async () => {
    const body = { title: f.title.trim(), contentType: f.contentType };
    if (f.contentType === "text") body.body = f.body;
    if (f.contentType === "video") body.videoUrl = f.videoUrl.trim();
    if (f.contentType === "link") body.externalUrl = f.externalUrl.trim();
    await call(`/teacher/courses/modules/${moduleId}/lessons`, { method: "POST", body });
    setF({ title: "", contentType: "text", body: "", videoUrl: "", externalUrl: "" });
    setOpen(false);
    await onChange();
  });
  if (!open) return <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Add a lesson</button>;
  return (
    <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); add.run(); }}>
      <Field label="Lesson title" id={`n-t-${moduleId}`} value={f.title} onChange={set("title")} required maxLength={150} />
      <Field label="Type" id={`n-y-${moduleId}`}><select id={`n-y-${moduleId}`} value={f.contentType} onChange={set("contentType")}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      {f.contentType === "text" && <Field label="Lesson text" id={`n-b-${moduleId}`}><textarea id={`n-b-${moduleId}`} className="tch-textarea" value={f.body} onChange={set("body")} maxLength={60000} /></Field>}
      {f.contentType === "video" && <Field label="Video link" id={`n-v-${moduleId}`} value={f.videoUrl} onChange={set("videoUrl")} required hint="A https YouTube or Vimeo link." />}
      {f.contentType === "link" && <Field label="Web link (https)" id={`n-x-${moduleId}`} value={f.externalUrl} onChange={set("externalUrl")} required />}
      {f.contentType === "pdf" && <p className="note">Save the lesson first, then choose the PDF by pressing Edit on it.</p>}
      <FormStatus error={add.error} slow={add.slow} />
      <div className="tch-actions"><button className="btn btn-primary" disabled={add.loading}>{add.loading ? "Adding…" : "Add lesson"}</button><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

// The course editor: details, chapters and lessons, and sending the course for review.
export default function TeacherCourse() {
  const { id } = useParams();
  const { token } = useAuth();
  const call = useCall();
  const [data, setData] = useState(null);
  const [review, setReview] = useState(undefined); // this course's open/returned review request
  const [err, setErr] = useState("");
  const [f, setF] = useState(null);
  const [chapter, setChapter] = useState("");
  const act = useAct();
  const [saved, setSaved] = useState("");

  const load = async () => {
    try {
      const [d, list] = await Promise.all([call(`/teacher/courses/${id}`), call("/teacher/courses")]);
      setData(d);
      setReview((list.courses.find((c) => String(c.id) === String(id)) || {}).review);
      setF((x) => x || { title: d.course.title, description: d.course.description || "", objectives: (d.course.objectives || []).join("\n"), difficulty: d.course.difficulty || "", estimatedMinutes: d.course.estimatedMinutes ?? "" });
    } catch (e) { setErr(e.message); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const saveDetails = useSubmit(async () => {
    const body = { title: f.title.trim(), description: f.description.trim(), objectives: f.objectives.split("\n").map((x) => x.trim()).filter(Boolean) };
    if (f.difficulty) body.difficulty = f.difficulty;
    if (f.estimatedMinutes !== "") body.estimatedMinutes = Number(f.estimatedMinutes);
    await call(`/teacher/courses/${id}`, { method: "PATCH", body });
    setSaved("Saved.");
    await load();
  });

  if (err) return <div className="admin-page"><p><Link to="/teacher/courses">← Courses</Link></p><div className="alert alert-error" role="alert">{err}</div></div>;
  if (!data || !f) return <div className="admin-page"><p className="muted" role="status">Loading…</p></div>;

  const { course, modules } = data;
  const waiting = review && review.status === "pending";
  const editable = course.status === "draft" && !waiting;
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };
  const move = (i, dir) => {
    const ids = modules.map((m) => m._id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    act.run(async () => { await call(`/teacher/courses/${id}/modules/order`, { method: "PUT", body: { ids } }); await load(); });
  };

  return (
    <div className="admin-page">
      <p><Link to="/teacher/courses">← Courses</Link></p>
      <PageHead eyebrow="Course" title={course.title}><StatusPill status={course.status} review={review} /></PageHead>
      {review && review.status === "returned" && review.note && <div className="tch-note">Returned by an administrator: {review.note}</div>}
      {!editable && <p className="note">{course.status !== "draft" ? "This course is published. Ask an administrator if it needs to change." : "This course is waiting for review, so it is locked. Withdraw it to edit."}</p>}

      {editable && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); saveDetails.run(); }}>
          <h2 className="panel-title">Details</h2>
          <Field label="Title" id="d-title" value={f.title} onChange={set("title")} required minLength={3} maxLength={150} />
          <Field label="Description" id="d-desc"><textarea id="d-desc" rows="3" value={f.description} onChange={set("description")} maxLength={3000} /></Field>
          <Field label="What students will be able to do (one per line)" id="d-obj"><textarea id="d-obj" rows="3" value={f.objectives} onChange={set("objectives")} /></Field>
          <div className="grid-2">
            <Field label="Level" id="d-lvl"><select id="d-lvl" value={f.difficulty} onChange={set("difficulty")}>{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Total minutes (optional)" id="d-min" type="number" min="0" value={f.estimatedMinutes} onChange={set("estimatedMinutes")} />
          </div>
          <FormStatus error={saveDetails.error} slow={saveDetails.slow} />
          {saved && <p className="note" role="status">{saved}</p>}
          <button className="btn btn-primary" disabled={saveDetails.loading}>{saveDetails.loading ? "Saving…" : "Save details"}</button>
        </form>
      )}

      <h2>Chapters and lessons</h2>
      {modules.length === 0 && <p className="muted">No chapters yet. Add a chapter, then add lessons to it.</p>}
      {modules.map((m, i) => (
        <section key={m._id} className="tch-mod">
          <div className="tch-actions" style={{ justifyContent: "space-between" }}>
            <h3>{m.title}</h3>
            {editable && (
              <div className="tch-actions">
                <button type="button" className="btn btn-secondary" aria-label={`Move ${m.title} up`} disabled={act.busy || i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn btn-secondary" aria-label={`Move ${m.title} down`} disabled={act.busy || i === modules.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="link-btn link-danger" disabled={act.busy} onClick={() => { if (window.confirm(`Delete the chapter "${m.title}"?`)) act.run(async () => { await call(`/teacher/courses/modules/${m._id}`, { method: "DELETE" }); await load(); }); }}>Delete</button>
              </div>
            )}
          </div>
          {m.lessons.length === 0 && <p className="muted">No lessons in this chapter yet.</p>}
          {m.lessons.map((l) => <Lesson key={l._id} lesson={l} editable={editable} call={call} token={token} onChange={load} />)}
          {editable && <div style={{ marginTop: ".6rem" }}><AddLesson moduleId={m._id} call={call} onChange={load} /></div>}
        </section>
      ))}
      {editable && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); if (chapter.trim()) act.run(async () => { await call(`/teacher/courses/${id}/modules`, { method: "POST", body: { title: chapter.trim() } }); setChapter(""); await load(); }); }}>
          <Field label="New chapter title" id="ch-title" value={chapter} onChange={(e) => setChapter(e.target.value)} maxLength={150} minLength={2} />
          <button className="btn btn-secondary" disabled={act.busy || chapter.trim().length < 2}>Add chapter</button>
        </form>
      )}
      <ActError act={act} />

      {course.status === "draft" && (
        <section className="panel">
          <h2 className="panel-title">Review</h2>
          {waiting ? (
            <>
              <p>Sent for review. An administrator will publish it or send it back with a note.</p>
              <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/courses/${id}/withdraw`, { method: "POST" }); await load(); })}>Withdraw from review</button>
            </>
          ) : (
            <>
              <p>A course needs a description and at least one lesson with content. Only an administrator can publish it to students.</p>
              <button type="button" className="btn btn-primary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/courses/${id}/submit`, { method: "POST" }); await load(); })}>Send for review</button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
