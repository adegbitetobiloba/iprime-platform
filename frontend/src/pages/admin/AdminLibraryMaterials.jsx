import { useState } from "react";
import { api } from "../../api.js";
import { useFetch } from "../../useFetch.js";
import Field from "../../components/Field.jsx";
import Markdown from "../../library/Markdown.jsx";
import { KIND_LABEL } from "../../library/parts.jsx";
import { MAX_IMAGE_MB, MAX_PDF_MB, uploadImageTo, uploadPdfTo } from "../../library/files.js";

const STATUS_LABEL = { draft: "Draft", published: "Published", archived: "Archived" };
const SOURCE_LABEL = { link: "Web link", text: "Written text", pdf: "PDF", image: "Images" };
const blank = { title: "", kind: "textbook", subject: "", examTags: "", author: "", description: "", sourceNote: "", source: "link", url: "", body: "" };

function MaterialForm({ initial, subjects, editing, onSave, onCancel, busy, progress }) {
  const [f, setF] = useState(initial);
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (f.source === "pdf" && file) {
      if (file.type && file.type !== "application/pdf") return setErr("Only PDF files can be uploaded.");
      if (file.size > MAX_PDF_MB * 1024 * 1024) return setErr(`That file is larger than ${MAX_PDF_MB} MB. Compress it and try again.`);
    }
    if (f.source === "image" && files.some((x) => !/^image\/(jpeg|png|webp)$/.test(x.type))) return setErr("Only JPEG, PNG or WebP images can be uploaded.");
    setErr("");
    const body = { title: f.title, kind: f.kind, subject: f.subject || null, description: f.description, author: f.author, sourceNote: f.sourceNote, examTags: f.examTags.split(",").map((t) => t.trim()).filter(Boolean) };
    if (f.source === "link") body.url = f.url;
    if (f.source === "text") body.body = f.body;
    if (!editing) body.source = f.source;
    return onSave(body, { file: f.source === "pdf" ? file : null, files: f.source === "image" ? files : [] });
  };
  return (
    <form className="panel form form-tight" onSubmit={submit}>
      <h2 className="panel-title">{editing ? "Edit material" : "Add a study material"}</h2>
      <Field label="Title" id="m-title" value={f.title} onChange={set("title")} required maxLength={150} />
      <div className="grid-2">
        <Field label="Type" id="m-kind"><select id="m-kind" value={f.kind} onChange={set("kind")}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Subject (optional)" id="m-subject"><select id="m-subject" value={f.subject} onChange={set("subject")}><option value="">None</option>{subjects.filter((s) => s.status === "active" && s.group === "subject").map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
      </div>
      <div className="grid-2">
        <Field label="Exam tags (commas)" id="m-tags" value={f.examTags} onChange={set("examTags")} hint="Use JAMB for anything students should see in the UTME hub." />
        <Field label="Author (optional)" id="m-author" value={f.author} onChange={set("author")} maxLength={120} />
      </div>
      <Field label="Short description (optional)" id="m-desc"><textarea id="m-desc" rows="2" value={f.description} onChange={set("description")} maxLength={1500} /></Field>
      <Field label="Source note students see (optional)" id="m-src" value={f.sourceNote} onChange={set("sourceNote")} maxLength={300} hint="For example: Source: JAMB UTME syllabus." />

      {!editing && (
        <fieldset className="lib-callout" style={{ border: "1px dashed var(--c-line-strong)" }}>
          <legend>How will you add it?</legend>
          <label className="check"><input type="radio" name="src" checked={f.source === "text"} onChange={() => setF((x) => ({ ...x, source: "text" }))} /> Type or paste the text (loads fastest, best for syllabus and notes)</label>
          <label className="check"><input type="radio" name="src" checked={f.source === "image" } onChange={() => setF((x) => ({ ...x, source: "image" }))} /> Upload images (photos or scans)</label>
          <label className="check"><input type="radio" name="src" checked={f.source === "pdf"} onChange={() => setF((x) => ({ ...x, source: "pdf" }))} /> Upload a PDF</label>
          <label className="check"><input type="radio" name="src" checked={f.source === "link"} onChange={() => setF((x) => ({ ...x, source: "link" }))} /> It is already on a website (instant, nothing stored)</label>
        </fieldset>
      )}

      {f.source === "text" && (
        <>
          <Field label="Text" id="m-body" hint="Use ## for section headings so students get a contents list and can search by topic."><textarea id="m-body" rows="16" value={f.body} onChange={set("body")} maxLength={200000} /></Field>
          <div className="form-actions"><button type="button" className="btn btn-secondary btn-sm" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>{preview ? "Hide preview" : "Preview text"}</button></div>
          {preview && <div className="lib-panel"><Markdown text={f.body} /></div>}
        </>
      )}
      {f.source === "link" && <Field label="Web link (https)" id="m-url" value={f.url} onChange={set("url")} maxLength={600} required hint="Only link to material you have the right to share." />}
      {f.source === "pdf" && (
        <Field label={editing ? "Replace the PDF (optional)" : "PDF file"} id="m-pdf" hint={`Up to ${MAX_PDF_MB} MB. Only upload books and papers you have permission to share.`}>
          <input id="m-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => { setFile(e.target.files[0] || null); setErr(""); }} />
        </Field>
      )}
      {f.source === "image" && (
        <Field label={editing ? "Add more images" : "Images"} id="m-img" hint={`JPEG, PNG or WebP. Large photos are shrunk automatically (limit ${MAX_IMAGE_MB} MB each). Choose them in reading order.`}>
          <input id="m-img" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { setFiles(Array.from(e.target.files)); setErr(""); }} />
        </Field>
      )}

      {progress && <p className="alert" role="status">{progress}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Save material"}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminLibraryMaterials({ token, subjects }) {
  const list = useFetch("/admin/library/materials");
  const [editor, setEditor] = useState(null); // null | "new" | material id
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  const run = async (fn, ok) => {
    setErr(""); setMsg("");
    try { const r = await fn(); if (ok) setMsg(typeof ok === "function" ? ok(r) : ok); list.reload(); return true; } catch (e) { setErr(e.details && e.details.length ? `${e.message} ${e.details.join(" ")}` : e.message); return false; }
  };
  const items = list.data ? list.data.materials : [];
  const current = editor && editor !== "new" ? items.find((x) => x._id === editor) : null;

  const save = async (body, { file, files }) => {
    setBusy(true);
    const ok = await run(async () => {
      let id = current ? current._id : null;
      if (editor === "new") id = (await api("/admin/library/materials", { method: "POST", token, body })).material._id;
      else await api(`/admin/library/materials/${id}`, { method: "PATCH", token, body });
      if (file) { setProgress("Uploading the PDF..."); await uploadPdfTo(`/admin/library/materials/${id}/pdf`, file, token); }
      for (let i = 0; i < files.length; i++) { setProgress(`Uploading image ${i + 1} of ${files.length}...`); await uploadImageTo(`/admin/library/materials/${id}/images`, files[i], token); }
    }, "Material saved. It stays hidden from students until you publish it.");
    setProgress(""); setBusy(false);
    if (ok) setEditor(null);
  };
  const status = (m, to) => run(() => api(`/admin/library/materials/${m._id}/status`, { method: "POST", token, body: { status: to } }), `Material is now ${STATUS_LABEL[to].toLowerCase()}.`);
  const seed = () => run(() => api("/admin/library/materials/seed-syllabi", { method: "POST", token }), (r) => (r.added ? `Added ${r.added} UTME syllabus draft${r.added === 1 ? "" : "s"}. Open each one, check it against JAMB's official syllabus, then publish.` : "The UTME syllabus drafts were already added."));
  const moveImage = (m, i, dir) => {
    const ids = m.images.map((x) => x.file);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api(`/admin/library/materials/${m._id}/images/order`, { method: "PUT", token, body: { ids } }));
  };
  const removeImage = (m, img) => { if (window.confirm("Remove this image?")) run(() => api(`/admin/library/materials/${m._id}/images/${img.file}`, { method: "DELETE", token }), "Image removed."); };

  const shown = filter === "all" ? items : items.filter((m) => m.status === filter);
  const count = (s) => items.filter((m) => m.status === s).length;
  const toInitial = (m) => ({ title: m.title, kind: m.kind, subject: m.subject ? m.subject._id : "", examTags: (m.examTags || []).join(", "), author: m.author || "", description: m.description || "", sourceNote: m.sourceNote || "", source: m.source, url: m.url || "", body: m.body || "" });

  return (
    <div>
      <div className="lib-head" style={{ marginBottom: 10 }}>
        <p className="muted" style={{ margin: 0 }}>Syllabus, textbooks, past questions and notes. Type the text, upload images or a PDF, or link to a website.</p>
        {editor === null && <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={seed}>Import the UTME syllabus texts</button><button type="button" className="btn btn-primary" onClick={() => setEditor("new")}>Add material</button></div>}
      </div>
      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}

      {editor !== null && (editor === "new" || current) && (
        <>
          <MaterialForm key={editor === "new" ? "new" : current._id} subjects={subjects} editing={editor !== "new"} busy={busy} progress={progress} onCancel={() => setEditor(null)} onSave={save} initial={editor === "new" ? blank : toInitial(current)} />
          {current && current.source === "image" && (
            <div className="lib-panel" style={{ marginTop: 12 }}>
              <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Images ({current.images.length})</h3>
              {current.images.length === 0 && <p className="note">No images yet. Use "Add more images" above.</p>}
              {current.images.map((img, i) => (
                <div key={img.file} className="lib-lesson-row"><span className="grow">{i + 1}. {img.name || "Image"}</span>
                  <button type="button" className="link-btn" disabled={i === 0} onClick={() => moveImage(current, i, -1)} aria-label={`Move image ${i + 1} up`}>Up</button>
                  <button type="button" className="link-btn" disabled={i === current.images.length - 1} onClick={() => moveImage(current, i, 1)} aria-label={`Move image ${i + 1} down`}>Down</button>
                  <button type="button" className="link-btn link-danger" onClick={() => removeImage(current, img)}>Remove</button></div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="lib-pills" role="group" aria-label="Filter by status" style={{ marginTop: 14 }}>
        {[["all", `All (${items.length})`], ["published", `Published (${count("published")})`], ["draft", `Drafts (${count("draft")})`], ["archived", `Archived (${count("archived")})`]].map(([k, label]) => <button key={k} type="button" className="lib-pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
      {list.loading && !list.data && <div className="exam-card skeleton" aria-hidden="true" />}
      {list.error && <p className="alert alert-error" role="alert">{list.error}</p>}
      {list.data && shown.length === 0 && <div className="lib-callout"><strong>{items.length === 0 ? "No study materials yet." : "Nothing here."}</strong><p style={{ margin: "4px 0 0" }}>{items.length === 0 ? "Press Import the UTME syllabus texts to add Physics, English, Mathematics and Chemistry as drafts, or Add material to start your own." : "Try another filter."}</p></div>}
      {shown.map((m) => (
        <div key={m._id} className="lib-lesson-row">
          <span className="grow"><strong>{m.title}</strong><br /><span className="muted">{KIND_LABEL[m.kind]}{m.subject ? ` · ${m.subject.name}` : ""}{(m.examTags || []).length ? ` · ${m.examTags.join(", ")}` : ""} · {SOURCE_LABEL[m.source]}{m.source === "pdf" && !m.file ? " (not uploaded yet)" : ""}{m.source === "image" ? ` (${(m.images || []).length})` : ""}</span></span>
          <span className={`badge ${m.status === "published" ? "badge-ok" : "badge-quiet"}`}>{STATUS_LABEL[m.status]}</span>
          <button type="button" className="link-btn" onClick={() => setEditor(m._id)}>Edit</button>
          {m.status !== "published" && m.status !== "archived" && <button type="button" className="link-btn" onClick={() => status(m, "published")}>Publish</button>}
          {m.status === "published" && <button type="button" className="link-btn" onClick={() => status(m, "draft")}>Unpublish</button>}
          {m.status === "archived" ? <button type="button" className="link-btn" onClick={() => status(m, "draft")}>Restore</button> : <button type="button" className="link-btn" onClick={() => status(m, "archived")}>Archive</button>}
        </div>
      ))}
    </div>
  );
}
