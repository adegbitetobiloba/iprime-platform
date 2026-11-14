import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { Async, Empty, PageHead, Pill, ActError, useAct } from "../teacher/ui.jsx";
import "../../teacher.css";

const STATE = { pending: ["Waiting for approval", "warn"], approved: ["Approved", "ok"], rejected: ["Rejected", "bad"], suspended: ["Suspended", "bad"], unreviewed: ["Needs first review", "warn"] };
const FILTERS = [["", "All"], ["pending", "Waiting"], ["approved", "Approved"], ["suspended", "Suspended"], ["rejected", "Rejected"], ["unreviewed", "Needs first review"]];

// A note box for actions that need a reason (reject, suspend, return).
function ReasonForm({ label, placeholder, busy, onConfirm, onCancel }) {
  const [note, setNote] = useState("");
  return (
    <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); if (note.trim()) onConfirm(note.trim()); }}>
      <label htmlFor="reason" className="sr-only">Reason</label>
      <textarea id="reason" rows="2" required maxLength={300} placeholder={placeholder} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="tch-actions"><button className="btn btn-primary" disabled={busy || !note.trim()}>{label}</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

// Subject groups and individually assigned students for one approved teacher.
function Access({ teacher }) {
  const { token } = useAuth();
  const groups = useFetch(`/admin/teachers/${teacher.id}/groups`);
  const direct = useFetch(`/admin/teachers/${teacher.id}/students`);
  const options = useFetch("/admin/teachers/options/subjects");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);
  const act = useAct();
  const call = (path, opts = {}) => api(path, { ...opts, token });

  const pickSubject = (v) => {
    setSubject(v); setCount(null);
    if (v.trim().length >= 2) call(`/admin/teachers/options/count?subject=${encodeURIComponent(v.trim())}`).then((d) => setCount(d.students)).catch(() => setCount(null));
  };

  return (
    <div className="tch-cols">
      <section>
        <h4>Subject groups</h4>
        <p className="muted">A subject group gives this teacher every student whose approved enrolment includes that subject, for that subject only. New students appear automatically.</p>
        <Async state={groups}>
          {groups.data && groups.data.groups.length === 0 ? <p className="muted">No subject groups.</p> : (
            <ul className="tch-list">
              {(groups.data?.groups || []).map((g) => (
                <li key={g.id} className="tch-row"><div><strong>{g.subject}</strong><small>{g.students} approved enrolment{g.students === 1 ? "" : "s"}</small></div>
                  <button type="button" className="link-btn link-danger" disabled={act.busy} onClick={() => act.run(async () => { await call(`/admin/teachers/${teacher.id}/groups/${g.id}`, { method: "DELETE" }); groups.reload(); })}>Remove</button></li>
              ))}
            </ul>
          )}
        </Async>
        <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); act.run(async () => { await call(`/admin/teachers/${teacher.id}/groups`, { method: "POST", body: { subject: subject.trim() } }); setSubject(""); setCount(null); groups.reload(); options.reload(); }); }}>
          <label htmlFor={`gs-${teacher.id}`}>Add a subject</label>
          <input id={`gs-${teacher.id}`} list={`gl-${teacher.id}`} value={subject} onChange={(e) => pickSubject(e.target.value)} placeholder="For example: Chemistry" maxLength={60} />
          <datalist id={`gl-${teacher.id}`}>{(options.data?.subjects || []).map((s) => <option key={s} value={s} />)}</datalist>
          {count !== null && <p className="note" role="status">This would cover {count} approved enrolment{count === 1 ? "" : "s"} today.</p>}
          <button className="btn btn-secondary" disabled={act.busy || subject.trim().length < 2}>Give this subject group</button>
        </form>
      </section>

      <section>
        <h4>Individual students</h4>
        <Async state={direct}>
          {direct.data && direct.data.students.length === 0 ? <p className="muted">No individually assigned students.</p> : (
            <ul className="tch-list">
              {(direct.data?.students || []).map((s) => (
                <li key={s.id} className="tch-row"><div><strong>{s.firstName} {s.lastName}</strong><small>{s.studentId}</small></div>
                  <button type="button" className="link-btn link-danger" disabled={act.busy} onClick={() => act.run(async () => { await call(`/admin/teachers/${teacher.id}/students/${s.id}`, { method: "DELETE" }); direct.reload(); })}>Remove</button></li>
              ))}
            </ul>
          )}
        </Async>
        <form className="form form-tight" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) act.run(async () => { const d = await call(`/admin/students?search=${encodeURIComponent(q.trim())}`); setFound(d.students || []); }); }}>
          <label htmlFor={`ss-${teacher.id}`}>Find a student to assign</label>
          <input id={`ss-${teacher.id}`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or student ID" />
          <button className="btn btn-secondary" disabled={act.busy || q.trim().length < 2}>Search</button>
        </form>
        {found && (found.length === 0 ? <p className="muted">No student found.</p> : (
          <ul className="tch-list">
            {found.slice(0, 8).map((s) => {
              const sid = s.id || s._id;
              return (
                <li key={sid} className="tch-row"><div><strong>{s.firstName} {s.lastName}</strong><small>{s.studentId}</small></div>
                  <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => act.run(async () => { await call(`/admin/teachers/${teacher.id}/students`, { method: "POST", body: { studentId: String(sid) } }); setFound(null); setQ(""); direct.reload(); })}>Assign</button></li>
              );
            })}
          </ul>
        ))}
      </section>
      <div style={{ gridColumn: "1 / -1" }}><ActError act={act} /></div>
    </div>
  );
}

function TeacherRow({ t, onChanged }) {
  const { token } = useAuth();
  const [ask, setAsk] = useState(null); // "reject" | "suspend" while a reason is needed
  const [manage, setManage] = useState(false);
  const act = useAct();
  const p = t.teacherProfile || {};
  const [label, tone] = STATE[t.state] || [t.state, undefined];
  const decide = (action, note) => act.run(async () => { await api(`/admin/teachers/${t.id}/decision`, { method: "POST", token, body: { action, ...(note ? { note } : {}) } }); setAsk(null); onChanged(); });

  return (
    <li className="panel" style={{ listStyle: "none" }}>
      <div className="tch-actions" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>{t.firstName} {t.lastName}</strong> <Pill tone={tone}>{label}</Pill> {!t.isVerified && <Pill>Email not verified</Pill>}
          <br /><small className="muted">{t.email} · {t.phone} · {t.state}</small>
        </div>
        <div className="tch-actions">
          {t.state === "approved" && <span className="muted">{t.activeStudents} direct student{t.activeStudents === 1 ? "" : "s"}</span>}
          {["pending", "unreviewed", "rejected"].includes(t.state) && <button type="button" className="btn btn-primary" disabled={act.busy || !t.isVerified} title={t.isVerified ? undefined : "The teacher must verify their email first"} onClick={() => decide("approve")}>Approve</button>}
          {["pending", "unreviewed"].includes(t.state) && <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => setAsk("reject")}>Reject</button>}
          {t.state === "approved" && <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => setAsk("suspend")}>Suspend</button>}
          {t.state === "suspended" && <button type="button" className="btn btn-primary" disabled={act.busy} onClick={() => decide("reinstate")}>Reinstate</button>}
          {t.state === "approved" && <button type="button" className="btn btn-secondary" aria-expanded={manage} onClick={() => setManage((m) => !m)}>{manage ? "Close" : "Students and subjects"}</button>}
        </div>
      </div>
      <p style={{ margin: ".5rem 0 0" }}>
        <small>Teaches: {(p.subjects || []).join(", ") || "not given"} · {p.qualification || "no qualification given"}{p.yearsExperience != null ? ` · ${p.yearsExperience} yr` : ""}</small>
        {p.bio && <><br /><small className="muted">{p.bio}</small></>}
        {t.approvalReview && t.approvalReview.note && <><br /><small className="muted">Last note: {t.approvalReview.note}</small></>}
      </p>
      {ask && <ReasonForm label={ask === "reject" ? "Reject application" : "Suspend teacher"} placeholder={ask === "reject" ? "Why is this application being rejected? The teacher is told." : "Why is this teacher being suspended? The teacher is told."} busy={act.busy} onConfirm={(n) => decide(ask, n)} onCancel={() => setAsk(null)} />}
      <ActError act={act} />
      {manage && t.state === "approved" && <Access teacher={t} />}
    </li>
  );
}

function Teachers() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q.trim().length >= 2) params.set("q", q.trim());
  const list = useFetch(`/admin/teachers${params.toString() ? `?${params}` : ""}`);
  const c = list.data?.counts;
  return (
    <>
      <div className="tch-tabs" role="group" aria-label="Filter teachers">
        {FILTERS.map(([v, l]) => <button key={v} type="button" className="tch-tab" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}{c && v && c[v] != null ? ` (${c[v]})` : ""}</button>)}
      </div>
      <input type="search" aria-label="Search teachers" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", maxWidth: "26rem", marginBottom: "1rem" }} />
      <Async state={list}>
        {list.data && list.data.teachers.length === 0 ? <Empty>No teachers here.</Empty> : (
          <ul style={{ padding: 0, margin: 0 }}>{(list.data?.teachers || []).map((t) => <TeacherRow key={t.id} t={t} onChanged={list.reload} />)}</ul>
        )}
      </Async>
    </>
  );
}

// Courses, tests and library materials teachers have asked to publish.
function Reviews() {
  const { token } = useAuth();
  const subs = useFetch("/admin/teachers/submissions?status=pending");
  const mats = useFetch("/admin/teachers/library/review");
  const [ask, setAsk] = useState(null); // `${kind}:${id}` while a return note is needed
  const act = useAct();
  const run = (path, action, note) => act.run(async () => { await api(path, { method: "POST", token, body: { action, ...(note ? { note } : {}) } }); setAsk(null); subs.reload(); mats.reload(); });
  const who = (t) => (t ? (t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim()) : "A teacher");

  return (
    <>
      <ActError act={act} />
      <h2>Courses and tests</h2>
      <Async state={subs}>
        {subs.data && subs.data.submissions.length === 0 ? <Empty>Nothing waiting.</Empty> : (
          <ul className="tch-list">
            {(subs.data?.submissions || []).map((s) => (
              <li key={s.id} className="panel" style={{ listStyle: "none" }}>
                <div className="tch-actions" style={{ justifyContent: "space-between" }}>
                  <div><strong>{s.title}</strong> <Pill tone="info">{s.kind === "exam" ? "Test" : "Course"}</Pill><br /><small className="muted">{who(s.teacher)} · sent {fmtDate(s.requestedAt)}</small></div>
                  <div className="tch-actions">
                    <Link className="btn btn-secondary" to={s.kind === "exam" ? `/admin/exams/${s.refId}` : `/admin/library/courses/${s.refId}`}>Inspect</Link>
                    <button type="button" className="btn btn-primary" disabled={act.busy} onClick={() => run(`/admin/teachers/submissions/${s.id}/decision`, "publish")}>Publish</button>
                    <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => setAsk(`s:${s.id}`)}>Return</button>
                  </div>
                </div>
                {ask === `s:${s.id}` && <ReasonForm label="Return to teacher" placeholder="What should the teacher change?" busy={act.busy} onConfirm={(n) => run(`/admin/teachers/submissions/${s.id}/decision`, "return", n)} onCancel={() => setAsk(null)} />}
              </li>
            ))}
          </ul>
        )}
      </Async>

      <h2>Library materials</h2>
      <p className="muted">To read a material before deciding, open <Link to="/admin/library">Library</Link>.</p>
      <Async state={mats}>
        {mats.data && mats.data.materials.length === 0 ? <Empty>Nothing waiting.</Empty> : (
          <ul className="tch-list">
            {(mats.data?.materials || []).map((m) => (
              <li key={m.id} className="panel" style={{ listStyle: "none" }}>
                <div className="tch-actions" style={{ justifyContent: "space-between" }}>
                  <div><strong>{m.title}</strong> <Pill>{m.kind}</Pill><br /><small className="muted">{who(m.teacher)} · {m.source} · sent {fmtDate(m.requestedAt)}</small></div>
                  <div className="tch-actions">
                    <button type="button" className="btn btn-primary" disabled={act.busy} onClick={() => run(`/admin/teachers/library/${m.id}/decision`, "publish")}>Publish</button>
                    <button type="button" className="btn btn-secondary" disabled={act.busy} onClick={() => setAsk(`m:${m.id}`)}>Return</button>
                  </div>
                </div>
                {ask === `m:${m.id}` && <ReasonForm label="Return to teacher" placeholder="What should the teacher change?" busy={act.busy} onConfirm={(n) => run(`/admin/teachers/library/${m.id}/decision`, "return", n)} onCancel={() => setAsk(null)} />}
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}

export default function AdminTeachers() {
  const [tab, setTab] = useState("teachers");
  const summary = useFetch("/admin/teachers/summary");
  const waiting = (summary.data?.pendingSubmissions || 0) + (summary.data?.materialsWaiting || 0);
  return (
    <div className="admin-page">
      <PageHead eyebrow="Administration" title="Teachers" />
      <div className="tch-tabs" role="group" aria-label="Teachers section">
        <button type="button" className="tch-tab" aria-pressed={tab === "teachers"} onClick={() => setTab("teachers")}>Teachers{summary.data?.pendingTeachers ? ` (${summary.data.pendingTeachers} waiting)` : ""}</button>
        <button type="button" className="tch-tab" aria-pressed={tab === "reviews"} onClick={() => setTab("reviews")}>Waiting for review{waiting ? ` (${waiting})` : ""}</button>
      </div>
      {tab === "teachers" ? <Teachers /> : <Reviews />}
    </div>
  );
}
