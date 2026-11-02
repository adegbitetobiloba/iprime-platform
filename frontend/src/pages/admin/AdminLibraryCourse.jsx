import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import Field from "../../components/Field.jsx";
import CourseForm, { courseBody, courseToForm } from "../../library/CourseForm.jsx";
import Markdown from "../../library/Markdown.jsx";
import { TYPE_LABEL } from "../../library/parts.jsx";
import { MAX_PDF_MB, uploadPdf } from "../../library/files.js";
import "../../library/library.css";

const STATUS_LABEL = { draft: "Draft", review: "Under review", published: "Published", archived: "Archived" };
const NEXT = {
  draft: [["review", "Submit for review"], ["published", "Publish"], ["archived", "Archive"]],
  review: [["published", "Publish"], ["draft", "Back to draft"], ["archived", "Archive"]],
  published: [["draft", "Unpublish"], ["archived", "Archive"]],
  archived: [["draft", "Restore to draft"]],
};
const badge = (s) => (s === "published" ? "badge-ok" : "badge-quiet");

// Moves one id up or down in a list and returns the new order.
const moved = (ids, i, dir) => {
  const next = ids.slice();
  const j = i + dir;
  if (j < 0 || j >= next.length) return null;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function LessonForm({ module, lesson, exams, onSave, onCancel, busy }) {
  const editing = !!lesson;
  const [f, setF] = useState({
    title: lesson ? lesson.title : "",
    contentType: lesson ? lesson.contentType : "text",
    topicId: lesson && lesson.topicId ? lesson.topicId : "",
    estimatedMinutes: String(lesson ? lesson.estimatedMinutes || 0 : 5),
    body: lesson ? lesson.body || "" : "",
    videoUrl: lesson && lesson.video ? lesson.video.url : "",
    externalUrl: lesson ? lesson.externalUrl || "" : "",
    practiceExam: lesson && lesson.practice && lesson.practice.exam ? lesson.practice.exam : "",
    practiceTopic: lesson && lesson.practice ? lesson.practice.topic || "" : "",
    requiresQuizPass: lesson ? !!lesson.requiresQuizPass : false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const body = {
      title: f.title, topicId: f.topicId || null, estimatedMinutes: Number(f.estimatedMinutes) || 0,
      practice: { exam: f.practiceExam || null, topic: f.practiceTopic },
      requiresQuizPass: f.requiresQuizPass && !!f.practiceExam,
    };
    if (!editing) body.contentType = f.contentType;
    if (f.contentType === "text") body.body = f.body;
    if (f.contentType === "video") body.videoUrl = f.videoUrl;
    if (f.contentType === "link") body.externalUrl = f.externalUrl;
    if (f.contentType === "pdf" && file) {
      if (file.type && file.type !== "application/pdf") return setFileError("Only PDF files can be uploaded.");
      if (file.size > MAX_PDF_MB * 1024 * 1024) return setFileError(`That file is larger than ${MAX_PDF_MB} MB. Compress it and try again.`);
    }
    return onSave(body, f.contentType === "pdf" ? file : null);
  };

  return (
    <form className="panel form form-tight" onSubmit={submit} style={{ marginTop: 12 }}>
      <h3 className="panel-title">{editing ? "Edit lesson" : "New lesson"}</h3>
      <Field label="Lesson title" id="l-title" value={f.title} onChange={set("title")} required maxLength={150} />
      <div className="grid-2">
        <Field label="Type" id="l-type">
          <select id="l-type" value={f.contentType} onChange={set("contentType")} disabled={editing}>
            <option value="text">Written lesson</option><option value="video">Video (YouTube or Vimeo)</option><option value="link">External resource</option><option value="pdf">PDF document</option>
          </select>
        </Field>
        <Field label="Topic" id="l-topic">
          <select id="l-topic" value={f.topicId} onChange={set("topicId")}>
            <option value="">No topic</option>
            {module.topics.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Estimated time (minutes)" id="l-min" type="number" min="0" max="1000" value={f.estimatedMinutes} onChange={set("estimatedMinutes")} />

      {f.contentType === "text" && (
        <>
          <Field label="Lesson text" id="l-body" hint="Plain text with simple formatting. See the guide below.">
            <textarea id="l-body" rows="12" value={f.body} onChange={set("body")} maxLength={60000} />
          </Field>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary btn-sm" aria-pressed={showPreview} onClick={() => setShowPreview((s) => !s)}>{showPreview ? "Hide preview" : "Preview text"}</button>
          </div>
          {showPreview && <div className="lib-panel"><Markdown text={f.body} /></div>}
          <details>
            <summary>Formatting guide</summary>
            <pre className="note" style={{ whiteSpace: "pre-wrap" }}>{`## Heading     ### Smaller heading
**bold**  *italic*  - bullet  1. numbered
> Definition: a highlighted definition box
> Note: a highlighted note box
| Name | Formula |   (a table needs a |---|---| line under the header)
|---|---|
$H_2O$  $x^2$  $x_{n+1}$   (subscripts and superscripts)
![diagram](https://link-to-image)   [link](https://example.com)`}</pre>
          </details>
        </>
      )}
      {f.contentType === "video" && <Field label="Video link" id="l-video" value={f.videoUrl} onChange={set("videoUrl")} maxLength={500} hint="A YouTube or Vimeo link. Other sites are not accepted." />}
      {f.contentType === "pdf" && (
        <Field label={lesson && lesson.pdf && lesson.pdf.file ? "Replace the PDF (optional)" : "PDF file"} id="l-pdf" hint={`Up to ${MAX_PDF_MB} MB. Students read it inside iPrime and cannot download it.${lesson && lesson.pdf && lesson.pdf.originalName ? ` Current file: ${lesson.pdf.originalName}.` : ""}`}>
          <input id="l-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => { setFile(e.target.files[0] || null); setFileError(""); }} />
          {fileError && <span className="field-error" role="alert">{fileError}</span>}
        </Field>
      )}
      {f.contentType === "link" && <Field label="Resource link (https)" id="l-ext" value={f.externalUrl} onChange={set("externalUrl")} maxLength={500} />}

      <div className="grid-2">
        <Field label="Practice exam (optional)" id="l-exam" hint="Students are sent to this existing examination. Questions are never copied.">
          <select id="l-exam" value={f.practiceExam} onChange={set("practiceExam")}>
            <option value="">None</option>
            {exams.map((x) => <option key={x.id} value={x.id}>{x.title}{x.status !== "published" ? " (not published)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Practice topic label (optional)" id="l-ptopic" value={f.practiceTopic} onChange={set("practiceTopic")} maxLength={120} />
      </div>
      {f.practiceExam && <label className="check"><input type="checkbox" checked={f.requiresQuizPass} onChange={(e) => setF((x) => ({ ...x, requiresQuizPass: e.target.checked }))} /> Students must score at least 50% on the practice exam to complete this lesson</label>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Save lesson"}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function Chapter({ module, index, total, courseStatus, exams, run, token, orderIds }) {
  const [title, setTitle] = useState(module.title);
  const [topics, setTopics] = useState(module.topics);
  const [editor, setEditor] = useState(null); // null | "new" | lessonId
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTitle(module.title); setTopics(module.topics); }, [module]);

  const saveLesson = async (body, file) => {
    setBusy(true);
    const ok = await run(async () => {
      let lessonId = editor;
      if (editor === "new") lessonId = (await api(`/admin/library/modules/${module._id}/lessons`, { method: "POST", token, body })).lesson._id;
      else await api(`/admin/library/lessons/${editor}`, { method: "PATCH", token, body });
      if (file) await uploadPdf(lessonId, file, token); // a failed upload leaves the lesson saved; the message says what to retry
    }, file ? "Lesson and PDF saved." : "Lesson saved.");
    setBusy(false);
    if (ok) setEditor(null);
  };
  const lessonIds = module.lessons.map((l) => l._id);
  const lessonStatus = (l, status) => run(() => api(`/admin/library/lessons/${l._id}`, { method: "PATCH", token, body: { status } }));

  return (
    <div className="lib-chapter">
      <div className="lib-chapter-head">
        <div className="form-actions" style={{ flex: 1 }}>
          <label className="sr-only" htmlFor={`m-${module._id}`}>Chapter title</label>
          <input id={`m-${module._id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} style={{ flex: 1, minWidth: 160 }} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={!title.trim() || title === module.title} onClick={() => run(() => api(`/admin/library/modules/${module._id}`, { method: "PATCH", token, body: { title } }), "Chapter renamed.")}>Rename</button>
        </div>
        <div className="form-actions">
          <button type="button" className="link-btn" disabled={index === 0} aria-label={`Move ${module.title} up`} onClick={() => orderIds("modules", moved(total, index, -1))}>Up</button>
          <button type="button" className="link-btn" disabled={index === total.length - 1} aria-label={`Move ${module.title} down`} onClick={() => orderIds("modules", moved(total, index, 1))}>Down</button>
          <button type="button" className="link-btn link-danger" onClick={() => { if (window.confirm(`Delete the chapter "${module.title}"? It must have no lessons.`)) run(() => api(`/admin/library/modules/${module._id}`, { method: "DELETE", token }), "Chapter deleted."); }}>Delete</button>
        </div>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary>Topics in this chapter ({topics.length})</summary>
        {topics.map((t, i) => (
          <div key={t._id || `n${i}`} className="form-actions" style={{ marginTop: 6 }}>
            <label className="sr-only" htmlFor={`t-${module._id}-${i}`}>Topic {i + 1}</label>
            <input id={`t-${module._id}-${i}`} value={t.title} maxLength={150} onChange={(e) => setTopics((ts) => ts.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} style={{ flex: 1 }} />
            <button type="button" className="link-btn link-danger" onClick={() => setTopics((ts) => ts.filter((_, k) => k !== i))}>Remove</button>
          </div>
        ))}
        <div className="form-actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTopics((ts) => ts.concat({ title: "" }))}>Add topic</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api(`/admin/library/modules/${module._id}`, { method: "PATCH", token, body: { topics: topics.filter((t) => t.title.trim()).map((t) => (t._id ? { _id: t._id, title: t.title } : { title: t.title })) } }), "Topics saved.")}>Save topics</button>
        </div>
      </details>

      <div style={{ marginTop: 10 }}>
        {module.lessons.length === 0 && <p className="note">No lessons in this chapter yet.</p>}
        {module.lessons.map((l, i) => (
          <div key={l._id} className="lib-lesson-row">
            <span className="grow"><strong>{l.title}</strong> <span className="muted">· {TYPE_LABEL[l.contentType]}{l.estimatedMinutes ? ` · ${l.estimatedMinutes} min` : ""}{l.practice && l.practice.exam ? " · practice" : ""}{l.contentType === "pdf" ? (l.pdf && l.pdf.file ? " · PDF attached" : " · no PDF yet") : ""}</span></span>
            <span className={`badge ${badge(l.status)}`}>{STATUS_LABEL[l.status]}</span>
            <button type="button" className="link-btn" onClick={() => setEditor(l._id)}>Edit</button>
            <Link className="link-btn" to={`/library/lessons/${l._id}`}>Preview</Link>
            {(l.status === "draft" || l.status === "review") && <button type="button" className="link-btn" onClick={() => lessonStatus(l, "published")}>Publish</button>}
            {l.status === "published" && <button type="button" className="link-btn" onClick={() => lessonStatus(l, "draft")}>Unpublish</button>}
            {l.status === "archived" ? <button type="button" className="link-btn" onClick={() => lessonStatus(l, "draft")}>Restore</button> : <button type="button" className="link-btn" onClick={() => lessonStatus(l, "archived")}>Archive</button>}
            {courseStatus === "draft" && <button type="button" className="link-btn link-danger" onClick={() => { if (window.confirm(`Delete the lesson "${l.title}"?`)) run(() => api(`/admin/library/lessons/${l._id}`, { method: "DELETE", token }), "Lesson deleted."); }}>Delete</button>}
            <button type="button" className="link-btn" disabled={i === 0} aria-label={`Move ${l.title} up`} onClick={() => orderIds("lessons", moved(lessonIds, i, -1), module._id)}>Up</button>
            <button type="button" className="link-btn" disabled={i === module.lessons.length - 1} aria-label={`Move ${l.title} down`} onClick={() => orderIds("lessons", moved(lessonIds, i, 1), module._id)}>Down</button>
            {editor === l._id && <div style={{ flexBasis: "100%" }}><LessonForm module={module} lesson={l} exams={exams} onSave={saveLesson} onCancel={() => setEditor(null)} busy={busy} /></div>}
          </div>
        ))}
        {editor === "new"
          ? <LessonForm module={module} lesson={null} exams={exams} onSave={saveLesson} onCancel={() => setEditor(null)} busy={busy} />
          : <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setEditor("new")}>Add lesson</button>}
      </div>
    </div>
  );
}

export default function AdminLibraryCourse() {
  const { id } = useParams();
  const { token } = useAuth();
  const tree = useFetch(`/admin/library/courses/${id}`);
  const subjects = useFetch("/admin/library/subjects");
  const exams = useFetch("/admin/exams");
  const [form, setForm] = useState(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (tree.data) setForm(courseToForm(tree.data.course)); }, [tree.data]);

  // Runs one change, shows the result, and refreshes the course. Returns true when it worked.
  const run = async (fn, ok) => {
    setErr(""); setMsg(""); setProblems([]);
    try { await fn(); if (ok) setMsg(ok); tree.reload(); return true; } catch (e) { setErr(e.message); if (e.details) setProblems(e.details); return false; }
  };

  const orderIds = (kind, ids, moduleId) => {
    if (!ids) return;
    const url = kind === "modules" ? `/admin/library/courses/${id}/modules/order` : `/admin/library/modules/${moduleId}/lessons/order`;
    run(() => api(url, { method: "PUT", token, body: { ids } }));
  };

  if (tree.loading && !tree.data) return <div className="admin-page"><div className="exam-card skeleton" aria-hidden="true" /></div>;
  if (tree.error && !tree.data) return <div className="admin-page"><p className="alert alert-error" role="alert">{tree.error}</p><Link to="/admin/library">Back to Library</Link></div>;
  if (!tree.data || !form) return null;

  const { course, modules } = tree.data;
  const moduleIds = modules.map((m) => m._id);
  const subs = subjects.data ? subjects.data.subjects : [];
  const examList = exams.data ? exams.data.exams : [];

  const saveDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    await run(() => api(`/admin/library/courses/${id}`, { method: "PATCH", token, body: courseBody(form) }), "Course details saved.");
    setSaving(false);
  };
  const setStatus = (status) => run(async () => {
    const r = await api(`/admin/library/courses/${id}/status`, { method: "POST", token, body: { status } });
    if (status === "published") setMsg(`Published. ${r.lessonsPublished} lesson${r.lessonsPublished === 1 ? "" : "s"} made visible${r.lessonsLeftInDraft ? `, ${r.lessonsLeftInDraft} left in draft because they have no content` : ""}.`);
    else setMsg(`Course is now ${STATUS_LABEL[status].toLowerCase()}.`);
  });

  return (
    <div className="admin-page">
      <p className="lib-crumbs"><Link to="/admin/library">Library</Link> › {course.title}</p>
      <div className="page-bar">
        <div><p className="eyebrow">Course</p><h1>{course.title}</h1><span className={`badge ${badge(course.status)}`}>{STATUS_LABEL[course.status]}</span></div>
        <div className="form-actions">
          <Link className="btn btn-secondary" to={`/library/courses/${course.slug}`}>Preview as student</Link>
          {NEXT[course.status].map(([to, label]) => <button key={to} type="button" className={`btn ${to === "published" ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatus(to)}>{label}</button>)}
        </div>
      </div>

      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && (
        <div className="alert alert-error" role="alert">
          {err}
          {problems.length > 0 && <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </div>
      )}

      <div className="lib-admin-grid two">
        <form className="panel form form-tight" onSubmit={saveDetails}>
          <h2 className="panel-title">Course details</h2>
          <CourseForm form={form} setForm={setForm} subjects={subs} />
          <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={saving} aria-busy={saving}>{saving ? "Saving..." : "Save details"}</button></div>
        </form>

        <div>
          <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>Chapters and lessons</h2>
          <p className="muted">Publishing the course also publishes every lesson that has content. Students only see published lessons in a published course.</p>
          {modules.map((m, i) => <Chapter key={m._id} module={m} index={i} total={moduleIds} courseStatus={course.status} exams={examList} run={run} token={token} orderIds={orderIds} />)}
          <form className="form-actions" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (chapterTitle.trim()) run(() => api(`/admin/library/courses/${id}/modules`, { method: "POST", token, body: { title: chapterTitle } }), "Chapter added.").then((ok) => ok && setChapterTitle("")); }}>
            <label className="sr-only" htmlFor="new-chapter">New chapter title</label>
            <input id="new-chapter" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="New chapter title" maxLength={150} style={{ flex: 1, minWidth: 160 }} />
            <button className="btn btn-primary" type="submit" disabled={!chapterTitle.trim()}>Add chapter</button>
          </form>
        </div>
      </div>
    </div>
  );
}
