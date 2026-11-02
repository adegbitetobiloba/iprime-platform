import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch } from "../../useFetch.js";
import { useSubmit } from "../../useSubmit.js";
import Field from "../../components/Field.jsx";
import FormStatus from "../../components/FormStatus.jsx";
import CourseForm, { blankCourse, courseBody } from "../../library/CourseForm.jsx";
import Countdown from "../../library/Countdown.jsx";
import AdminLibraryMaterials from "./AdminLibraryMaterials.jsx";
import "../../library/library.css";

const STATUS_LABEL = { draft: "Draft", review: "Under review", published: "Published", archived: "Archived" };
const badge = (s) => (s === "published" ? "badge-ok" : "badge-quiet");
const TABS = [["courses", "Courses"], ["materials", "Study materials"], ["subjects", "Subjects"], ["countdown", "Exam countdown"]];

function CountdownTab({ token }) {
  const { data, loading, error, reload } = useFetch("/admin/library/countdown");
  const [f, setF] = useState({ label: "UTME 2027", date: "", official: false, enabled: true, note: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (data && data.countdown) setF({ ...data.countdown }); }, [data]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setMsg(""); setErr("");
    try { await api("/admin/library/countdown", { method: "PUT", token, body: { label: f.label, date: f.date, official: f.official, enabled: f.enabled, note: f.note } }); setMsg("Saved. Students now see this countdown."); reload(); } catch (x) { setErr(x.message); }
  };
  const preview = f.date && !Number.isNaN(new Date(`${f.date}T00:00:00+01:00`).getTime()) ? { label: f.label || "the exam", targetDate: new Date(`${f.date}T00:00:00+01:00`).toISOString(), official: f.official, note: f.note } : null;
  return (
    <div className="lib-admin-grid two">
      <form className="panel form form-tight" onSubmit={save}>
        <h2 className="panel-title">Exam countdown</h2>
        <p className="muted">Students see this on the Library home page and the UTME hub.</p>
        {loading && !data && <p aria-busy="true">Loading...</p>}
        {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
        <Field label="Name" id="cd-label" value={f.label} onChange={set("label")} required maxLength={60} hint="For example: UTME 2027" />
        <Field label="Exam date" id="cd-date" type="date" value={f.date} onChange={set("date")} required />
        <label className="check"><input type="checkbox" checked={f.official} onChange={(e) => setF((x) => ({ ...x, official: e.target.checked }))} /> JAMB has officially confirmed this date</label>
        <p className="muted" style={{ marginTop: 0 }}>Leave this off until JAMB publishes the date. Students then see "Proposed date. Not yet confirmed by JAMB."</p>
        <Field label="Note for students (optional)" id="cd-note" value={f.note} onChange={set("note")} maxLength={200} />
        <label className="check"><input type="checkbox" checked={f.enabled} onChange={(e) => setF((x) => ({ ...x, enabled: e.target.checked }))} /> Show the countdown to students</label>
        {msg && <p className="alert alert-success" role="status">{msg}</p>}
        {err && <p className="alert alert-error" role="alert">{err}</p>}
        <button className="btn btn-primary" type="submit">Save countdown</button>
      </form>
      <div><h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>What students will see</h2>{preview ? <Countdown countdown={preview} /> : <p className="note">Pick a date to preview it.</p>}</div>
    </div>
  );
}

export default function AdminLibrary() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const courses = useFetch("/admin/library/courses");
  const subjects = useFetch("/admin/library/subjects");
  const [tab, setTab] = useState("courses");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankCourse);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [subName, setSubName] = useState("");
  const [subGroup, setSubGroup] = useState("subject");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const subs = subjects.data ? subjects.data.subjects : [];
  const list = courses.data ? courses.data.courses : [];
  const needsSetup = subjects.data && subs.length === 0;

  const create = useSubmit(async () => {
    const r = await api("/admin/library/courses", { method: "POST", token, body: courseBody(form) });
    navigate(`/admin/library/courses/${r.course._id}`);
  });
  const note = async (fn, ok) => { setErr(""); setMsg(""); try { const r = await fn(); if (ok) setMsg(typeof ok === "function" ? ok(r) : ok); subjects.reload(); } catch (x) { setErr(x.message); } };
  const seed = () => note(() => api("/admin/library/subjects/seed", { method: "POST", token }), (r) => (r.added ? `Added ${r.added} subjects and exam groups.` : "Everything was already added."));
  const addSubject = (e) => { e.preventDefault(); return note(() => api("/admin/library/subjects", { method: "POST", token, body: { name: subName, group: subGroup } }), "Added.").then(() => setSubName("")); };
  const toggle = (s) => note(() => api(`/admin/library/subjects/${s._id}`, { method: "PATCH", token, body: { status: s.status === "active" ? "archived" : "active" } }));

  const count = (s) => list.filter((c) => c.status === s).length;
  const shown = list.filter((c) => (filter === "all" || c.status === filter) && (!search.trim() || c.title.toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="admin-page">
      <div className="page-bar">
        <div><p className="eyebrow">Administration</p><h1>Library</h1></div>
        <Link to="/admin/library/analytics" className="btn btn-secondary">Learning analytics</Link>
      </div>

      {needsSetup && (
        <div className="lib-callout" style={{ marginBottom: 16 }}>
          <strong>Start here</strong>
          <p style={{ margin: "4px 0 10px" }}>Add the standard subjects (English, Mathematics, Biology and the rest) and the exam groups (JAMB, WAEC, NECO, GCE, Post-UTME) in one click. You can change them later.</p>
          <button type="button" className="btn btn-primary" onClick={seed}>Add standard subjects and exam groups</button>
        </div>
      )}
      {msg && <p className="alert alert-success" role="status">{msg}</p>}
      {err && <p className="alert alert-error" role="alert">{err}</p>}

      <div className="lib-tabs" role="tablist" aria-label="Library sections">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" className="lib-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === "courses" && (
        <div>
          <div className="lib-head" style={{ marginBottom: 12 }}>
            <div className="lib-pills" role="group" aria-label="Filter by status" style={{ margin: 0 }}>
              {[["all", `All (${list.length})`], ["published", `Published (${count("published")})`], ["draft", `Drafts (${count("draft")})`], ["review", `Review (${count("review")})`], ["archived", `Archived (${count("archived")})`]].map(([k, label]) => <button key={k} type="button" className="lib-pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
            </div>
            {!creating && <button type="button" className="btn btn-primary" onClick={() => { setCreating(true); setForm(blankCourse); }} disabled={!subs.some((s) => s.status === "active")}>New course</button>}
          </div>
          {creating && (
            <form className="panel form form-tight" onSubmit={(e) => { e.preventDefault(); create.run(); }} style={{ marginBottom: 16 }}>
              <h2 className="panel-title">New course</h2>
              <CourseForm form={form} setForm={setForm} subjects={subs} />
              <FormStatus error={create.error} slow={create.slow} />
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={create.loading} aria-busy={create.loading}>{create.loading ? "Creating..." : "Create and continue"}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setCreating(false)} disabled={create.loading}>Cancel</button>
              </div>
            </form>
          )}
          <div className="lib-search" style={{ maxWidth: 420, marginTop: 0, marginBottom: 14 }}>
            <label className="sr-only" htmlFor="c-search">Search courses</label>
            <input id="c-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your courses" />
          </div>
          {courses.error && <p className="alert alert-error" role="alert">{courses.error}</p>}
          {courses.loading && !courses.data && <div className="exam-card skeleton" aria-hidden="true" />}
          {courses.data && shown.length === 0 && <div className="lib-callout"><strong>{list.length === 0 ? "No courses yet." : "No course matches."}</strong><p style={{ margin: "4px 0 0" }}>{list.length === 0 ? (subs.some((s) => s.status === "active") ? "Press New course to create your first one." : "Add subjects first (see Start here above or the Subjects tab).") : "Try another filter or search."}</p></div>}
          <ul className="lib-grid">
            {shown.map((c) => (
              <li key={c._id} className="lib-card"><Link className="lib-card-link" to={`/admin/library/courses/${c._id}`}>
                <div className="lib-card-body">
                  <div className="exam-tags"><span className={`badge ${badge(c.status)}`}>{STATUS_LABEL[c.status]}</span>{c.featured && <span className="badge badge-quiet">Featured</span>}</div>
                  <h3>{c.title}</h3>
                  <p className="lib-meta">{c.subject ? c.subject.name : ""} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}</p>
                </div>
              </Link></li>
            ))}
          </ul>
        </div>
      )}

      {tab === "materials" && <AdminLibraryMaterials token={token} subjects={subs} />}

      {tab === "subjects" && (
        <div className="lib-admin-grid two">
          <div>
            <form className="panel form form-tight" onSubmit={addSubject}>
              <h2 className="panel-title">Add one</h2>
              <Field label="Name" id="s-name" value={subName} onChange={(e) => setSubName(e.target.value)} required maxLength={80} hint="For example: Chemistry, or JAMB" />
              <Field label="Type" id="s-group"><select id="s-group" value={subGroup} onChange={(e) => setSubGroup(e.target.value)}><option value="subject">Subject</option><option value="exam-prep">Exam group</option></select></Field>
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
            <p style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" onClick={seed}>Add the standard subjects and exam groups</button></p>
          </div>
          <div>
            {["subject", "exam-prep"].map((g) => (
              <div key={g} style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: "1.05rem", margin: "0 0 4px" }}>{g === "subject" ? "Subjects" : "Exam groups"}</h2>
                {subs.filter((s) => s.group === g).length === 0 && <p className="note">None yet.</p>}
                {subs.filter((s) => s.group === g).map((s) => (
                  <div key={s._id} className="lib-lesson-row"><span className="grow">{s.name}</span><span className={`badge ${s.status === "active" ? "badge-ok" : "badge-quiet"}`}>{s.status === "active" ? "Active" : "Archived"}</span><button type="button" className="link-btn" onClick={() => toggle(s)}>{s.status === "active" ? "Archive" : "Restore"}</button></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "countdown" && <CountdownTab token={token} />}
    </div>
  );
}
