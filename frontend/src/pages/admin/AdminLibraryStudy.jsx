import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";
import "../../studentDashboard.css";
import "../../adminAnalytics.css";

const STATUS = {
  active: { label: "Studying", cls: "badge-ok" },
  quiet: { label: "Quiet lately", cls: "badge-quiet" },
  not_started: { label: "Not started yet", cls: "badge-quiet" },
};

// Who is using the Library and who has not started. Staff only (the server enforces it).
// Wording is a prompt for a friendly check-in, never a judgement of the student.
export default function AdminLibraryStudy() {
  const { data: d, error, loading, reload } = useFetch("/admin/analytics/library-study");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (d?.students || [])
      .filter((s) => status === "all" || s.status === status)
      .filter((s) => !term || `${s.name} ${s.studentId || ""}`.toLowerCase().includes(term));
  }, [d, q, status]);

  return (
    <div className="admin-page aa">
      <div className="page-bar">
        <div>
          <p className="eyebrow">Administration · Analytics</p>
          <h1>Library study by student</h1>
          <p className="muted">How much each student has studied in the Library, and when they last did.</p>
        </div>
        <div className="aa-nav">
          <Link to="/admin/analytics" className="btn btn-secondary btn-sm">All analytics</Link>
          <Link to="/admin/library/analytics" className="btn btn-secondary btn-sm">Course and lesson analytics</Link>
        </div>
      </div>

      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}

      {d && d.totals.students === 0 && <p className="note">There are no student accounts yet.</p>}

      {d && d.totals.students > 0 && (
        <>
          {d.truncated && <p className="alert alert-info" role="note">Showing the most recent {d.totals.students} students.</p>}
          <ul className="sd-stats" aria-label="Summary">
            <li className="sd-stat"><span className="sd-stat-label">Students</span><span className="sd-stat-num">{d.totals.students}</span></li>
            <li className="sd-stat"><span className="sd-stat-label">Studying</span><span className="sd-stat-num">{d.totals.active}</span><span className="sd-stat-note">Active in the last {d.definitions.quietDays} days</span></li>
            <li className="sd-stat"><span className="sd-stat-label">Quiet lately</span><span className="sd-stat-num">{d.totals.quiet}</span><span className="sd-stat-note">{d.definitions.quietDays}+ days since last study</span></li>
            <li className="sd-stat"><span className="sd-stat-label">Not started yet</span><span className="sd-stat-num">{d.totals.notStarted}</span></li>
          </ul>

          <div className="aa-filters">
            <label className="aa-search"><span className="sr-only">Search students</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or student ID" /></label>
            <label className="aa-check"><span>Show</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by study status">
                <option value="all">Everyone</option><option value="active">Studying</option><option value="quiet">Quiet lately</option><option value="not_started">Not started yet</option>
              </select>
            </label>
          </div>

          {rows.length === 0 ? <p className="note">No student matches.</p> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Student</th><th>Status</th><th>Lessons completed</th><th>Minutes studied</th><th>Courses</th><th>Last studied</th></tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.userId}>
                      <td><strong>{s.name}</strong>{s.studentId && <><br /><span className="muted">{s.studentId}</span></>}</td>
                      <td><span className={`badge ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span></td>
                      <td>{s.lessonsCompleted}<span className="muted"> of {s.lessonsOpened} opened</span></td>
                      <td>{s.studyMinutes}</td>
                      <td>{s.coursesStarted}</td>
                      <td>{s.lastActiveAt ? fmtDate(s.lastActiveAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted sd-small">Based on the Library's recorded progress. "Not started yet" simply means no Library activity has been recorded.</p>
        </>
      )}
    </div>
  );
}
