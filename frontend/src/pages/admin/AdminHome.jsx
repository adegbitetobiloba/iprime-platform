import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";

// Every number comes from /api/admin/overview, which counts records in the database.
export default function AdminHome() {
  const { data, error, loading, reload } = useFetch("/admin/overview");
  const stats = data && [
    ["Students", data.students], ["Verified students", data.verifiedStudents], ["Parents and guardians", data.parents],
    ["Examinations", data.exams], ["Published examinations", data.publishedExams], ["Questions in total", data.questions],
    ["Submitted attempts", data.submittedAttempts], ["Attempts in the last 7 days", data.attemptsLast7Days],
    ["Published programmes", data.publishedProgrammes],
  ];

  return (
    <div className="admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Overview</h1>
      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {stats && (
        <ul className="stat-grid stat-grid-3">
          {stats.map(([label, value]) => (
            <li key={label} className="stat"><span className="stat-num">{value}</span><span className="stat-label">{label}</span></li>
          ))}
        </ul>
      )}
      {data && data.students === 0 && data.exams === 0 && <p className="note">Nothing has been recorded yet. Figures appear here as students register and examinations are created.</p>}
      <div className="panel">
        <h2 className="panel-title">Manage</h2>
        <div className="form-actions">
          <Link to="/admin/students" className="btn btn-primary">Students</Link>
          <Link to="/admin/exams" className="btn btn-secondary">Examinations</Link>
          <Link to="/admin/programmes" className="btn btn-secondary">Programmes</Link>
        </div>
        <p className="muted" style={{ marginTop: "var(--s4)" }}>Events, news and announcements, and role management, are planned and will appear here when they are built.</p>
      </div>
    </div>
  );
}
