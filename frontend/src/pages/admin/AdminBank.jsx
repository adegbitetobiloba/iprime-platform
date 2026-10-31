import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import Field from "../../components/Field.jsx";
import SafeHtml from "../../components/SafeHtml.jsx";
import { PROBLEM_LABELS } from "../../lib/import/importFlow.js";
import "../../import.css";

const OPTIONS = ["A", "B", "C", "D", "E", "F"];
const FLAGS = [["", "All questions"], ["usable", "Ready to use"], ["incomplete", "Incomplete"], ["missing_answer", "Missing answer"], ["missing_explanation", "Missing explanation"], ["awaiting_solution", "Awaiting a solution"], ["invalid_options", "Invalid options"], ["missing_visual", "Needs a diagram"], ["duplicate", "Possible duplicates"], ["verified", "Verified"], ["unverified", "Not verified"]];
const snippet = (t, n = 120) => (t.length > n ? `${t.slice(0, n)}…` : t);

// ---- edit one question ----
function EditPanel({ id, onClose, onChanged }) {
  const { token } = useAuth();
  const [q, setQ] = useState(null);
  const [f, setF] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: "", note: "" });
  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const d = await api(`/admin/bank/${id}`, { token });
      setQ(d.question);
      setF({ subject: d.question.subject || "", topic: d.question.topic || "", subtopic: d.question.subtopic || "", text: d.question.text || "", explanation: d.question.explanation || "", solutionText: d.question.solution?.text || "", correctKey: d.question.correctKey || "", marks: d.question.marks ?? 1, imageRef: d.question.imageRef || "", options: OPTIONS.map((k) => ({ key: k, text: (d.question.options.find((o) => o.key === k) || {}).text || "" })) });
      setState({ loading: false, saving: false, error: "", note: "" });
    } catch (e) { setState({ loading: false, saving: false, error: e.message, note: "" }); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const act = async (path, body, done) => {
    setState((s) => ({ ...s, saving: true, error: "", note: "" }));
    try { const d = await api(path, { method: "POST", token, body }); setState((s) => ({ ...s, saving: false, note: done(d) })); onChanged(); await load(); }
    catch (e) { setState((s) => ({ ...s, saving: false, error: e.message })); }
  };
  const save = async () => {
    setState((s) => ({ ...s, saving: true, error: "", note: "" }));
    try {
      const body = { subject: f.subject, topic: f.topic, subtopic: f.subtopic, text: f.text, explanation: f.explanation, solutionText: f.solutionText, correctKey: f.correctKey || null, marks: Number(f.marks) || 1, imageRef: f.imageRef, options: f.options.filter((o) => o.text.trim()), expectedVersion: q.version || 1 };
      const d = await api(`/admin/bank/${id}`, { method: "PATCH", token, body });
      onChanged(); await load();
      setState((s) => ({ ...s, note: d.problems.length ? `Saved. Still to fix: ${d.problems.map((p) => p.message).join(" ")}` : "Saved. This question is complete and can be used in examinations." }));
    } catch (e) { setState((s) => ({ ...s, saving: false, error: e.message })); }
  };

  if (state.loading && !q) return <div className="dialog-overlay"><div className="dialog" role="status">Loading…</div></div>;
  if (!q) return <div className="dialog-overlay"><div className="dialog"><p className="alert alert-error" role="alert">{state.error}</p><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></div></div>;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setOpt = (k, text) => setF((x) => ({ ...x, options: x.options.map((o) => (o.key === k ? { ...o, text } : o)) }));
  const filled = f.options.filter((o) => o.text.trim());
  const verified = q.verification?.status === "verified";
  return (
    <div className="dialog-overlay">
      <div className="dialog ix-editor" role="dialog" aria-modal="true" aria-labelledby="bk-title">
        <h2 id="bk-title">{q.externalId || "Question"} <span className="muted ix-small">version {q.version || 1}</span></h2>
        {q.textHtml && <div className="ix-preview"><span className="ix-small muted">Formatted version students see:</span><SafeHtml html={q.textHtml} text={q.text} /></div>}
        {q.textHtml && <p className="alert alert-warn">Changing the wording removes this formatting (such as underlining).</p>}
        {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
        {state.note && <p className="alert alert-ok" role="status">{state.note}</p>}
        <div className="grid-2">
          <Field label="Subject" id="b-subject" value={f.subject} onChange={set("subject")} maxLength={80} />
          <Field label="Topic" id="b-topic" value={f.topic} onChange={set("topic")} maxLength={120} />
        </div>
        <Field label="Subtopic" id="b-sub" value={f.subtopic} onChange={set("subtopic")} maxLength={120} />
        <label htmlFor="b-text">Question</label>
        <textarea id="b-text" className="ix-textarea" rows={5} value={f.text} onChange={set("text")} />
        <div className="ix-opts">
          {f.options.map((o) => (<div key={o.key} className="ix-opt"><label htmlFor={`b-${o.key}`}>Option {o.key}</label><input id={`b-${o.key}`} className="ix-input" value={o.text} onChange={(e) => setOpt(o.key, e.target.value)} /></div>))}
        </div>
        <div className="grid-2">
          <div><label htmlFor="b-ans">Correct answer</label>
            <select id="b-ans" className="ix-select" value={f.correctKey} onChange={set("correctKey")}><option value="">Not decided</option>{filled.map((o) => <option key={o.key} value={o.key}>{o.key}</option>)}</select>
          </div>
          <Field label="Marks" id="b-marks" type="number" min="0.5" max="100" step="0.5" value={f.marks} onChange={set("marks")} />
        </div>
        <label htmlFor="b-expl">Explanation from the source{q.explanationSource ? ` (${q.explanationSource})` : ""}</label>
        <textarea id="b-expl" className="ix-textarea" rows={3} value={f.explanation} onChange={set("explanation")} />
        <label htmlFor="b-sol">Solution written by an administrator (shown to students with that label)</label>
        <textarea id="b-sol" className="ix-textarea" rows={4} value={f.solutionText} onChange={set("solutionText")} placeholder="Working, formulas and units go here." />
        {q.solution?.at && <p className="muted ix-small">Last written {fmtDate(q.solution.at)}.</p>}
        <p className="muted ix-small">Source: {(q.source?.refs || []).join(", ") || "none given"}{q.source?.page ? ` · page ${q.source.page}` : ""}{q.source?.label ? ` · ${q.source.label}` : ""}{q.sourceStatus ? ` · the file said “${q.sourceStatus}”` : ""}{q.questionType ? ` · ${q.questionType}` : ""}{q.imageRef ? ` · image: ${q.imageRef}` : ""}</p>
        {q.review?.notes && <p className="muted ix-small">Reviewer’s note from the file: {q.review.notes}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={state.saving} aria-busy={state.saving}>{state.saving ? "Saving…" : "Save changes"}</button>
          <button type="button" className="btn btn-secondary" disabled={state.saving} onClick={() => act(`/admin/bank/${id}/verify`, { verified: !verified }, () => (verified ? "Marked as not verified." : "Marked as verified by you."))}>{verified ? "Remove verification" : "Mark as verified"}</button>
          <button type="button" className="btn btn-secondary" disabled={state.saving} onClick={() => act(`/admin/bank/${id}/propagate`, {}, (d) => `Copied into ${d.updated} draft examination(s)${d.skipped.length ? `; ${d.skipped.length} left unchanged because they are published or already attempted` : ""}.`)}>Update draft exams that use it</button>
          <button type="button" className="btn btn-quiet" disabled={state.saving} onClick={() => act(`/admin/bank/${id}/${q.status === "archived" ? "restore" : "archive"}`, {}, () => (q.status === "archived" ? "Restored." : "Archived."))}>{q.status === "archived" ? "Restore" : "Archive"}</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        {(q.history || []).length > 0 && (
          <details className="ix-history"><summary>Change history ({q.history.length})</summary>
            <ul className="plain-list">{[...q.history].reverse().map((h, i) => <li key={i}><strong>{h.action}</strong> · {fmtDate(h.at)} · version {h.version}{h.fields?.length ? ` · ${h.fields.map((x) => x.field).join(", ")}` : ""}</li>)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}

export default function AdminBank() {
  const { token } = useAuth();
  const [f, setF] = useState({ q: "", subject: "", topic: "", flag: "", type: "", sourceStatus: "", status: "active" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [examId, setExamId] = useState("");
  const [msg, setMsg] = useState({ ok: "", err: "" });

  const query = useMemo(() => { const p = new URLSearchParams({ page: String(page), limit: "25" }); Object.entries(applied).forEach(([k, v]) => v && p.set(k, v)); return `/admin/bank?${p}`; }, [applied, page]);
  const list = useFetch(query);
  const facets = useFetch("/admin/bank/facets");
  const exams = useFetch("/admin/exams");
  const drafts = (exams.data?.exams || []).filter((e) => e.status !== "published");
  const reload = () => { list.reload(); facets.reload(); };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const search = (e) => { e.preventDefault(); setApplied(f); setPage(1); setPicked(new Set()); };
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const addToExam = async () => {
    setMsg({ ok: "", err: "" });
    try {
      const d = await api("/admin/bank/add-to-exam", { method: "POST", token, body: { examId, ids: [...picked] } });
      const why = d.skipped.length ? ` ${d.skipped.length} not added (${[...new Set(d.skipped.map((s) => s.reason.replace(/_/g, " ")))].join(", ")}).` : "";
      setMsg({ ok: `${d.added} question${d.added === 1 ? "" : "s"} added. The exam now has ${d.questionCount}.${why}`, err: "" });
      setPicked(new Set());
    } catch (e) { setMsg({ ok: "", err: e.message }); }
  };

  const t = facets.data?.totals;
  const topics = (facets.data?.topics || []).filter((x) => !f.subject || x.subject === f.subject);
  return (
    <div className="admin-page ix">
      <div className="page-bar">
        <div><p className="eyebrow">Question bank</p><h1>Questions</h1></div>
        <Link to="/admin/import" className="btn btn-primary">Import questions</Link>
      </div>

      {t && (
        <section className="ix-stats" aria-label="Totals">
          <div className="ix-stat"><strong>{t.active}</strong><span>Active</span></div>
          <div className="ix-stat"><strong>{t.usable}</strong><span>Ready to use</span></div>
          <div className="ix-stat"><strong>{t.incomplete}</strong><span>Incomplete</span></div>
          <div className="ix-stat"><strong>{t.awaitingSolution}</strong><span>Need a solution</span></div>
          <div className="ix-stat"><strong>{t.archived}</strong><span>Archived</span></div>
        </section>
      )}

      <form className="panel ix-filters" onSubmit={search}>
        <Field label="Search" id="f-q" value={f.q} onChange={set("q")} placeholder="Words, ID or topic" maxLength={100} />
        <div><label htmlFor="f-subject">Subject</label><select id="f-subject" className="ix-select" value={f.subject} onChange={set("subject")}><option value="">All</option>{(facets.data?.subjects || []).map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}</select></div>
        <div><label htmlFor="f-topic">Topic</label><select id="f-topic" className="ix-select" value={f.topic} onChange={set("topic")}><option value="">All</option>{topics.map((s) => <option key={`${s.subject}-${s.name}`} value={s.name}>{s.name} ({s.count})</option>)}</select></div>
        <div><label htmlFor="f-flag">Show</label><select id="f-flag" className="ix-select" value={f.flag} onChange={set("flag")}>{FLAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="f-ss">File’s review status</label><select id="f-ss" className="ix-select" value={f.sourceStatus} onChange={set("sourceStatus")}><option value="">Any</option><option>Verified</option><option>Unverified</option><option>Needs Review</option></select></div>
        <div><label htmlFor="f-st">Archived</label><select id="f-st" className="ix-select" value={f.status} onChange={set("status")}><option value="active">Hide archived</option><option value="archived">Only archived</option></select></div>
        <div className="ix-filter-go"><button type="submit" className="btn btn-primary">Search</button></div>
      </form>

      {list.error && <p className="alert alert-error" role="alert">{list.error}</p>}
      {msg.err && <p className="alert alert-error" role="alert">{msg.err}</p>}
      {msg.ok && <p className="alert alert-ok" role="status">{msg.ok}</p>}

      {picked.size > 0 && (
        <div className="panel ix-addbar" role="region" aria-label="Add to an examination">
          <strong>{picked.size} selected</strong>
          <select aria-label="Examination" className="ix-select" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Choose a draft examination</option>{drafts.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <button type="button" className="btn btn-primary" disabled={!examId} onClick={addToExam}>Add to examination</button>
          <button type="button" className="btn btn-quiet" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      {list.loading && !list.data && <div className="exam-card skeleton" aria-hidden="true" />}
      {list.data && list.data.questions.length === 0 && <p className="note">No questions match. {t && t.active === 0 ? "Import a workbook to get started." : "Try clearing a filter."}</p>}
      {list.data && list.data.questions.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table ix-table">
              <thead><tr><th><span className="sr-only">Select</span></th><th>ID</th><th>Question</th><th>Subject / topic</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {list.data.questions.map((q) => (
                  <tr key={q.id}>
                    <td><input type="checkbox" aria-label={`Select ${q.externalId || "question"}`} checked={picked.has(q.id)} disabled={!q.usable || q.status !== "active"} onChange={() => toggle(q.id)} title={q.usable ? "" : "Finish this question before using it in an exam"} /></td>
                    <td><strong>{q.externalId || "—"}</strong></td>
                    <td><p className="ix-q">{snippet(q.text || "(no question text)")}</p><span className="muted ix-small">{q.optionCount} options{q.correctKey ? ` · answer ${q.correctKey}` : ""}{q.hasFormatting ? " · formatted" : ""}</span></td>
                    <td>{q.subject}<br /><span className="muted ix-small">{q.topic}</span></td>
                    <td>
                      {q.usable ? <span className="badge ix-badge-ok">Ready</span> : q.problems.map((p) => <span key={p} className="badge ix-badge-bad">{PROBLEM_LABELS[p] || p}</span>)}
                      {q.awaitingSolution && <span className="badge ix-badge-warn">No explanation</span>}
                      {q.verified ? <span className="badge ix-badge-ok">Verified</span> : q.sourceStatus === "Needs Review" ? <span className="badge ix-badge-warn">Needs review</span> : <span className="badge badge-quiet">Not verified</span>}
                      {q.edited && <span className="badge badge-quiet">Edited</span>}
                      {q.status === "archived" && <span className="badge badge-quiet">Archived</span>}
                    </td>
                    <td><button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(q.id)}>{q.usable ? "Edit" : "Complete"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ix-pager">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {list.data.page} of {list.data.pages} · {list.data.total} questions</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>
      )}

      {open && <EditPanel id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
