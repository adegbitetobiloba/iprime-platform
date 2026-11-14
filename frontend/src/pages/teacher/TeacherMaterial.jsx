import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import { ActError, PageHead, StatusPill, splitList, uploadFile, openFile, useAct, useCall } from "./ui.jsx";

const KINDS = [["notes", "Notes"], ["syllabus", "Syllabus"], ["textbook", "Textbook"], ["past-questions", "Past questions"], ["other", "Other"]];
const SOURCES = [["text", "Written text (loads fastest on a phone)"], ["pdf", "PDF document"], ["image", "Images (photos of notes or pages)"], ["link", "Web link"]];

// Create a material, or edit/read one. Teachers can only change their own drafts; everything else is read-only here.
export default function TeacherMaterial() {
  const { id } = useParams();
  const isNew = id === "new";
  const { token } = useAuth();
  const navigate = useNavigate();
  const call = useCall();
  const subjects = useFetch("/teacher/library/subjects");
  const [m, setM] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [f, setF] = useState({ title: "", kind: "notes", subject: "", description: "", author: "", examTags: "", source: "text", url: "", body: "", sourceNote: "" });
  const [saved, setSaved] = useState("");
  const act = useAct();

  const load = () => call(`/teacher/library/materials/${id}`).then((d) => {
    setM(d.material);
    setF({ title: d.material.title || "", kind: d.material.kind, subject: "", description: d.material.description || "", author: d.material.author || "", examTags: (d.material.examTags || []).join(", "), source: d.material.source, url: d.material.url || "", body: d.material.body || "", sourceNote: d.material.sourceNote || "" });
  }).catch((e) => setLoadErr(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isNew) load(); }, [id]);

  const locked = !isNew && m && !(m.mine && m.status === "draft" && !(m.review && m.review.requestedAt));
  const set = (k) => (e) => { setSaved(""); setF((x) => ({ ...x, [k]: e.target.value })); };

  const save = useSubmit(async () => {
    const common = { title: f.title.trim(), kind: f.kind, description: f.description.trim(), author: f.author.trim(), examTags: splitList(f.examTags), sourceNote: f.sourceNote.trim() };
    if (f.subject) common.subject = f.subject;
    if (f.source === "link") common.url = f.url.trim();
    if (f.source === "text") common.body = f.body;
    if (isNew) {
      const d = await call("/teacher/library/materials", { method: "POST", body: { ...common, source: f.source } });
      navigate(`/teacher/library/${d.material._id || d.material.id}`, { replace: true });
    } else {
      await call(`/teacher/library/materials/${id}`, { method: "PATCH", body: common });
      setSaved("Saved.");
      await load();
    }
  });

  const upload = (path) => (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) act.run(async () => { await uploadFile(path, file, token); await load(); });
  };
  const subjectOptions = (subjects.data?.subjects || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>);

  if (!isNew && loadErr) return <div className="admin-page"><p><Link to="/teacher/library">← Library materials</Link></p><div className="alert alert-error" role="alert">{loadErr}</div></div>;
  if (!isNew && !m) return <div className="admin-page"><p className="muted" role="status">Loading…</p></div>;

  return (
    <div className="admin-page">
      <p><Link to="/teacher/library">← Library materials</Link></p>
      <PageHead eyebrow="Library" title={isNew ? "New material" : m.title}>
        {!isNew && <StatusPill status={m.status} review={m.review && m.review.requestedAt ? { status: "pending" } : m.review && m.review.returnedAt ? { status: "returned" } : undefined} />}
      </PageHead>
      {!isNew && m.mine && m.review && m.review.returnedAt && !m.review.requestedAt && m.review.note && <div className="tch-note">Returned by an administrator: {m.review.note}</div>}
      {locked && m.mine && <p className="note">{m.status === "published" ? "This material is published. Ask an administrator if it needs to change." : "This material is waiting for review, so it is locked. Withdraw it to edit."}</p>}
      {locked && !m.mine && <p className="note">You are reading this material. Only its author can edit it.</p>}

      {isNew || !locked ? (
        <form className="panel form" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
          <Field label="Title" id="m-title" value={f.title} onChange={set("title")} required maxLength={150} />
          <div className="grid-2">
            <Field label="Kind" id="m-kind"><select id="m-kind" value={f.kind} onChange={set("kind")}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Subject" id="m-subject"><select id="m-subject" value={f.subject} onChange={set("subject")} required={isNew}><option value="">{isNew ? "Choose a subject" : "Keep current subject"}</option>{subjectOptions}</select></Field>
          </div>
          {isNew && <Field label="How will students read it?" id="m-source"><select id="m-source" value={f.source} onChange={set("source")}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          {f.source === "text" && <Field label="Text" id="m-body" hint="Plain text. Leave a blank line between paragraphs."><textarea id="m-body" className="tch-textarea" value={f.body} onChange={set("body")} maxLength={200000} /></Field>}
          {f.source === "link" && <Field label="Web link (https only)" id="m-url" type="url" value={f.url} onChange={set("url")} maxLength={500} />}
          {(f.source === "pdf" || f.source === "image") && isNew && <p className="note">You will add the {f.source === "pdf" ? "PDF" : "images"} on the next screen, right after you save.</p>}
          <Field label="Short description (optional)" id="m-desc"><textarea id="m-desc" rows="2" value={f.description} onChange={set("description")} maxLength={1500} /></Field>
          <div className="grid-2">
            <Field label="Author (optional)" id="m-author" value={f.author} onChange={set("author")} maxLength={120} />
            <Field label="Exam tags (optional)" id="m-tags" value={f.examTags} onChange={set("examTags")} hint="For example: JAMB, WAEC" />
          </div>
          <Field label="Where it came from (optional)" id="m-src" value={f.sourceNote} onChange={set("sourceNote")} maxLength={300} hint="Only upload material you wrote or have permission to share." />
          <FormStatus error={save.error} slow={save.slow} />
          {saved && <p className="note" role="status">{saved}</p>}
          <button className="btn btn-primary" disabled={save.loading}>{save.loading ? "Saving…" : isNew ? "Create draft" : "Save changes"}</button>
        </form>
      ) : (
        <section className="panel">
          {m.description && <p>{m.description}</p>}
          {m.source === "text" && <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>}
          {m.source === "link" && <p><a href={m.url} target="_blank" rel="noopener noreferrer">Open the link</a></p>}
          {m.source === "pdf" && m.pdfAvailable && <button type="button" className="btn btn-secondary" onClick={() => act.run(() => openFile(`/teacher/library/materials/${id}/pdf`, token))}>Open the PDF</button>}
          {m.source === "image" && (m.images || []).map((im, i) => <p key={im.id}><button type="button" className="link-btn" onClick={() => act.run(() => openFile(`/teacher/library/materials/${id}/images/${im.id}`, token))}>View image {i + 1}{im.name ? ` (${im.name})` : ""}</button></p>)}
          {m.sourceNote && <p className="muted">{m.sourceNote}</p>}
        </section>
      )}

      {!isNew && m.mine && !locked && m.source === "pdf" && (
        <section className="panel">
          <h2 className="panel-title">PDF file</h2>
          <p>{m.pdfAvailable ? "A PDF is attached. Choosing another file replaces it." : "No PDF yet."} Maximum 20 MB.</p>
          <input type="file" accept="application/pdf" aria-label="Choose a PDF" disabled={act.busy} onChange={upload(`/teacher/library/materials/${id}/pdf`)} />
        </section>
      )}
      {!isNew && m.mine && !locked && m.source === "image" && (
        <section className="panel">
          <h2 className="panel-title">Images</h2>
          <ul className="tch-list">
            {(m.images || []).map((im, i) => (
              <li key={im.id} className="tch-row"><div><strong>Image {i + 1}</strong><small>{im.name}</small></div>
                <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/library/materials/${id}/images/${im.id}`, { method: "DELETE" }); await load(); })}>Remove</button></li>
            ))}
          </ul>
          <p>JPEG, PNG or WebP, up to 8 MB each. Images are read in the order you add them.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Add an image" disabled={act.busy} onChange={upload(`/teacher/library/materials/${id}/images`)} />
        </section>
      )}

      {!isNew && m.mine && m.status === "draft" && (
        <section className="panel">
          <h2 className="panel-title">Review</h2>
          {m.review && m.review.requestedAt ? (
            <>
              <p>Sent for review. An administrator will publish it or send it back with a note.</p>
              <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/library/materials/${id}/withdraw`, { method: "POST" }); await load(); })}>Withdraw from review</button>
            </>
          ) : (
            <>
              <p>When it is ready, send it for review. Only an administrator can publish it to students.</p>
              <button type="button" className="btn btn-primary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/teacher/library/materials/${id}/submit`, { method: "POST" }); await load(); })}>Send for review</button>
            </>
          )}
        </section>
      )}
      <ActError act={act} />
    </div>
  );
}
