import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import { ProgressBar } from "../library/parts.jsx";
import "../library/library.css";

// Drop-in card for the Student Dashboard: <LibraryDashboardCard />. Shows real Library activity only; renders nothing it cannot back with data.
export default function LibraryDashboardCard() {
  const { data, error, loading } = useFetch("/library/me/summary");
  if (loading) return <div className="exam-card skeleton" aria-hidden="true" />;
  if (error || !data) return null; // the dashboard must still work if the Library is unavailable

  return (
    <section className="lib-panel" aria-labelledby="lib-dash-h">
      <div className="lib-head"><h2 id="lib-dash-h" style={{ fontSize: "1.1rem", margin: 0 }}>Library</h2><Link to="/library" className="link-btn">Open Library</Link></div>
      {data.coursesStarted === 0 ? (
        <p className="muted" style={{ marginTop: 10 }}>You have not started a course yet. <Link to="/library">Browse courses</Link></p>
      ) : (
        <>
          <div className="lib-stat-grid" style={{ margin: "14px 0" }}>
            <div className="lib-stat"><strong>{data.lessonsCompleted}</strong>lessons completed</div>
            <div className="lib-stat"><strong>{data.coursesStarted}</strong>courses started</div>
            <div className="lib-stat"><strong>{data.studyMinutes}</strong>minutes studied</div>
          </div>
          <ul className="lib-outline">
            {data.courses.slice(0, 4).map((c) => (
              <li key={c.id} style={{ marginBottom: 10 }}>
                <Link to={`/library/courses/${c.slug}`}><strong>{c.title}</strong></Link>
                <ProgressBar percent={c.percent} label={`${c.title} progress`} />
                <span className="lib-bar-label"><span>{c.completed} of {c.total} lessons</span><span>{c.percent}%</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
