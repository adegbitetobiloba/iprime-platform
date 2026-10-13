import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";

export default function AdminHome() {
  const { data, error, loading } = useFetch("/admin/exams");
  const exams = data?.exams || [];
  const stats = [
    ["Examinations", exams.length],
    ["Published", exams.filter((e) => e.status === "published").length],
    ["Drafts", exams.filter((e) => e.status === "draft").length],
    ["Submitted attempts", exams.reduce((n, e) => n + e.attempts, 0)],
  ];

  return (
    <div className="admin-page">
      <p className="eyebrow">Administration</p>
      <h1>Overview</h1>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && (
        <ul className="stat-grid">
          {stats.map(([label, value]) => (
            <li key={label} className="stat"><span className="stat-num">{value}</span><span className="stat-label">{label}</span></li>
          ))}
        </ul>
      )}
      <div className="panel" style={{ marginTop: "var(--s5)" }}>
        <h2 className="panel-title">Manage</h2>
        <div className="form-actions"><Link to="/admin/exams" className="btn btn-primary">Manage examinations</Link><Link to="/admin/programmes" className="btn btn-secondary">Manage programmes</Link></div>
        <p className="muted">Student, parent, event and announcement management are planned and will appear here when they are built.</p>
      </div>
    </div>
  );
}
