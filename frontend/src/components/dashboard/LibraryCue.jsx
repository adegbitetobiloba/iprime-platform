import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { summariseLibrary } from "../../lib/libraryReport.js";

// "Study in the Library" block for the Performance page: real Library activity, or an invitation when there is none.
// If the Library cannot be reached the block is simply not shown, so Performance never breaks because of it.
export default function LibraryCue() {
  const { data, error, loading } = useFetch("/library/me/summary");
  if (loading) return <div className="sd-card skeleton" aria-hidden="true" style={{ minHeight: 90, marginTop: 24 }} />;
  if (error || !data) return null;
  const s = summariseLibrary(data);

  return (
    <section className="sd-section" aria-labelledby="pf-lib">
      <div className="sd-section-head"><h2 id="pf-lib">Study in the Library</h2><Link to="/library" className="sd-link">Open Library</Link></div>
      {!s ? (
        <div className="sd-card sd-empty">
          <p className="muted">Practice goes further with study. Your lessons and progress will appear here once you start a Library course.</p>
          <Link to="/library" className="btn btn-primary btn-sm">Browse the Library</Link>
        </div>
      ) : (
        <div className="sd-card">
          <p className="sd-lib-stats muted">
            <strong>{s.lessonsCompleted}</strong> lesson{s.lessonsCompleted === 1 ? "" : "s"} completed
            {s.studyMinutes > 0 && <> · <strong>{s.studyMinutes}</strong> min studied</>}
            {s.coursesStarted > 0 && <> · <strong>{s.coursesStarted}</strong> course{s.coursesStarted === 1 ? "" : "s"} started</>}
          </p>
          <ul className="sd-list">
            {s.courses.map((c) => (
              <li key={c.id} className="sd-subject">
                <div className="sd-subject-top"><Link to={`/library/courses/${c.slug || ""}`.replace(/\/$/, "")}><strong>{c.title}</strong></Link><span>{c.percent}%</span></div>
                <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.percent} aria-label={`${c.title} progress`}><span style={{ width: `${c.percent}%` }} /></div>
                <span className="muted sd-small">{c.completed} of {c.total} lessons</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
