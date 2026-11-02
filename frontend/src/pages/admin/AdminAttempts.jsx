import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";
import "./builder.css";

const STATUS = { in_progress: "In progress", submitted: "Submitted" };

// Examiner's list of student attempts: search by name / student ID / email, filter by examination and status.
export default function AdminAttempts() {
  const [params, setParams] = useSearchParams();
  const exam = params.get("exam") || "", status = params.get("status") || "", page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  const [text, setText] = useState(params.get("q") || "");
  const [q, setQ] = useState(text);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]); // wait a moment after typing

  const set = (k, v) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); if (k !== "page") n.delete("page"); return n; }, { replace: true });
  useEffect(() => { if ((params.get("q") || "") !== q) set("q", q); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const exams = useFetch("/admin/exams");
  const url = useMemo(() => { const p = new URLSearchParams({ page: String(page), limit: "20" }); if (exam) p.set("exam", exam); if (status) p.set("status", status); if (q) p.set("q", q); return `/admin/attempts?${p}`; }, [exam, status, q, page]);
  const { data, error, loading } = useFetch(url);

  return (
    <div className="admin-page">
      <div className="page-bar"><div><p className="eyebrow">Administration</p><h1>Student attempts</h1><p className="muted">Open any attempt to see the exact questions that student was given, their answers and the correct ones.</p></div></div>

      <div className="panel form form-tight">
        <div className="xb-browser-head" style={{ border: 0, padding: 0 }}>
          <input type="search" aria-label="Search students" placeholder="Search by name, student ID or email" value={text} onChange={(e) => setText(e.target.value)} />
          <select aria-label="Examination" value={exam} onChange={(e) => set("exam", e.target.value)}>
            <option value="">All examinations</option>
            {(exams.data?.exams || []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => set("status", e.target.value)}>
            <option value="">Any status</option><option value="submitted">Submitted</option><option value="in_progress">In progress</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <p className="muted" role="status">Loading attempts...</p>}
      {data && data.attempts.length === 0 && <p className="note">No attempts match. Try clearing the search or filters.</p>}
      {data && data.attempts.length > 0 && (
        <>
          <p className="muted" role="status">{data.total} attempt{data.total === 1 ? "" : "s"}</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Examination</th><th>Status</th><th>Score</th><th>Questions</th><th>Started</th></tr></thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/admin/attempts/${a.id}`}><strong>{a.student.name}</strong></Link><br /><span className="muted">{a.student.studentId || a.student.email || ""}</span></td>
                    <td>{a.exam.title}{a.drawn && <><br /><span className="muted">Own draw of questions</span></>}</td>
                    <td><span className={`badge ${a.status === "submitted" ? "badge-ok" : "badge-quiet"}`}>{STATUS[a.status] || a.status}</span>{a.autoSubmitted && <><br /><span className="muted">Time ran out</span></>}</td>
                    <td>{a.status === "submitted" && a.percentage !== null ? <><strong>{a.percentage}%</strong><br /><span className="muted">{a.score} / {a.totalMarks}</span></> : <span className="muted">{a.answered} answered so far</span>}</td>
                    <td>{a.questionCount ?? "—"}</td>
                    <td>{fmtDate(a.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="xb-nav">
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>Previous</button>
              <span className="muted">Page {page} of {data.pages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => set("page", String(page + 1))}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
