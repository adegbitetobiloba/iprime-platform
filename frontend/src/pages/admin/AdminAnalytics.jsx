import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";
import "../../studentDashboard.css";
import "../../adminAnalytics.css";

// Starting point for analytics: pick an examination to see how students did.
// Only examinations with at least one submission can be analysed, so the others are clearly marked, not hidden.
export default function AdminAnalytics() {
  const { data, error, loading, reload } = useFetch("/admin/exams");
  const [q, setQ] = useState("");
  const [onlyWithResults, setOnly] = useState(true);

  const exams = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.exams || [])
      .filter((e) => (onlyWithResults ? e.attempts > 0 : true))
      .filter((e) => !term || `${e.title} ${e.subject || ""} ${e.level || ""}`.toLowerCase().includes(term))
      .sort((a, b) => (b.attempts - a.attempts) || a.title.localeCompare(b.title));
  }, [data, q, onlyWithResults]);

  return (
    <div className="admin-page aa">
      <div className="page-bar">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Analytics</h1>
          <p className="muted">Examination results, and how students are using the Library. Choose an examination below to see scores, hard questions, topics and who may need support.</p>
        </div>
      </div>

      <ul className="aa-list aa-more">
        <li className="aa-item"><div className="aa-item-main"><strong>Library study by student</strong><span className="muted">Who is studying, who has gone quiet and who has not started.</span></div><div className="aa-item-end"><Link to="/admin/analytics/library-study" className="btn btn-secondary btn-sm">Open</Link></div></li>
        <li className="aa-item"><div className="aa-item-main"><strong>Library course and lesson analytics</strong><span className="muted">Most used courses, where students stop, video engagement.</span></div><div className="aa-item-end"><Link to="/admin/library/analytics" className="btn btn-secondary btn-sm">Open</Link></div></li>
      </ul>

      <div className="aa-filters">
        <label className="aa-search">
          <span className="sr-only">Search examinations</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, subject or level" />
        </label>
        <label className="aa-check">
          <input type="checkbox" checked={onlyWithResults} onChange={(e) => setOnly(e.target.checked)} />
          <span>Only examinations with results</span>
        </label>
      </div>

      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}

      {data && exams.length === 0 && (
        <p className="note">
          {(data.exams || []).length === 0 ? "There are no examinations yet." : onlyWithResults && !q ? "No student has submitted an examination yet. Results will appear here once they do." : "No examination matches your search."}
        </p>
      )}

      {data && exams.length > 0 && (
        <ul className="aa-list">
          {exams.map((e) => (
            <li key={e.id} className="aa-item">
              <div className="aa-item-main">
                <strong>{e.title}</strong>
                <span className="muted">{[e.subject, e.level, e.status === "published" ? "Published" : "Draft", e.updatedAt ? `Updated ${fmtDate(e.updatedAt)}` : null].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="aa-item-end">
                <span className="badge badge-quiet">{e.attempts} submission{e.attempts === 1 ? "" : "s"}</span>
                {e.attempts > 0 ? <Link to={`/admin/exams/${e.id}/analytics`} className="btn btn-secondary btn-sm">View analytics</Link> : <span className="muted aa-none">Nothing to analyse yet</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
