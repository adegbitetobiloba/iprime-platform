import { useState } from "react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";

const blank = { title: "", summary: "", description: "", audience: "", subjects: "", mode: "", schedule: "", status: "draft", order: "0" };
const toForm = (p) => ({
  title: p.title || "", summary: p.summary || "", description: p.description || "", audience: p.audience || "",
  subjects: (p.subjects || []).join(", "), mode: p.mode || "", schedule: p.schedule || "", status: p.status || "draft", order: String(p.order ?? 0),
});

export default function AdminProgrammes() {
  const { token } = useAuth();
  const { data, error, loading, reload } = useFetch("/admin/programmes");
  const [editing, setEditing] = useState(null); // null = closed, "new" or a programme id
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState("");
  const [actionError, setActionError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useSubmit(async () => {
    const body = {
      ...form,
      subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      order: Number(form.order) || 0,
    };
    if (editing === "new") await api("/admin/programmes", { method: "POST", token, body });
    else await api(`/admin/programmes/${editing}`, { method: "PATCH", token, body });
    setSaved(editing === "new" ? "Programme created." : "Programme saved.");
    setEditing(null);
    reload();
  });

  const open = (p) => { setSaved(""); setActionError(""); save.setError(""); setForm(p ? toForm(p) : blank); setEditing(p ? p._id : "new"); };
  const remove = async (p) => {
    if (!window.confirm(`Delete the programme "${p.title}"?`)) return;
    setActionError("");
    try { await api(`/admin/programmes/${p._id}`, { method: "DELETE", token }); reload(); } catch (e) { setActionError(e.message); }
  };
  const toggle = async (p) => {
    setActionError("");
    try { await api(`/admin/programmes/${p._id}`, { method: "PATCH", token, body: { status: p.status === "published" ? "draft" : "published" } }); reload(); } catch (e) { setActionError(e.message); }
  };

  const list = data?.programmes || [];
  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>Programmes</h1></div>
        {!editing && <button type="button" className="btn btn-primary" onClick={() => open(null)}>New programme</button>}
      </div>
      <p className="muted">Only programmes marked Published appear on the website. Add only what the institution has confirmed.</p>
      {saved && <p className="alert alert-success" role="status">{saved}</p>}
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}

      {editing && (
        <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); save.run(); }}>
          <h2 className="panel-title">{editing === "new" ? "New programme" : "Edit programme"}</h2>
          <Field label="Programme name" id="p-title" value={form.title} onChange={set("title")} required maxLength={120} />
          <Field label="Short summary (shown on cards)" id="p-summary" value={form.summary} onChange={set("summary")} maxLength={240} />
          <Field label="Full description" id="p-desc"><textarea id="p-desc" rows="4" value={form.description} onChange={set("description")} maxLength={3000} /></Field>
          <div className="grid-2">
            <Field label="Who it is for (classes or levels)" id="p-aud" value={form.audience} onChange={set("audience")} maxLength={120} hint="For example: SS 1 to SS 3" />
            <Field label="Subjects (separate with commas)" id="p-sub" value={form.subjects} onChange={set("subjects")} hint="For example: Mathematics, English Language" />
          </div>
          <div className="grid-2">
            <Field label="How it is delivered" id="p-mode">
              <select id="p-mode" value={form.mode} onChange={set("mode")}>
                <option value="">Not specified</option><option value="physical">In person</option><option value="online">Online</option><option value="hybrid">In person and online</option>
              </select>
            </Field>
            <Field label="Schedule (optional)" id="p-sched" value={form.schedule} onChange={set("schedule")} maxLength={300} />
          </div>
          <div className="grid-2">
            <Field label="Status" id="p-status">
              <select id="p-status" value={form.status} onChange={set("status")}>
                <option value="draft">Draft (hidden)</option><option value="published">Published (visible on the website)</option>
              </select>
            </Field>
            <Field label="Display order (0 shows first)" id="p-order" type="number" min="0" max="1000" value={form.order} onChange={set("order")} />
          </div>
          <FormStatus error={save.error} slow={save.slow} />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={save.loading} aria-busy={save.loading}>{save.loading ? "Saving..." : "Save programme"}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)} disabled={save.loading}>Cancel</button>
          </div>
        </form>
      )}

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && list.length === 0 && !editing && <p className="note">No programmes yet. Add the first one.</p>}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Programme</th><th>Status</th><th>Order</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.title}</strong><br /><span className="muted">{p.audience}{p.subjects?.length ? ` · ${p.subjects.join(", ")}` : ""}</span></td>
                  <td><span className={`badge ${p.status === "published" ? "badge-ok" : "badge-quiet"}`}>{p.status === "published" ? "Published" : "Draft"}</span></td>
                  <td>{p.order}</td>
                  <td className="row-actions">
                    <button type="button" className="link-btn" onClick={() => open(p)}>Edit</button>
                    <button type="button" className="link-btn" onClick={() => toggle(p)}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
                    <button type="button" className="link-btn link-danger" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
