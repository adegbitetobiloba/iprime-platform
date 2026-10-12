import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";

function Skeleton() {
  return (
    <div className="exam-grid" aria-hidden="true">
      {[1, 2, 3].map((n) => <div key={n} className="exam-card skeleton" />)}
    </div>
  );
}

function action(e) {
  if (e.inProgressAttemptId) return { label: "Resume", className: "btn btn-primary", to: `/exams/${e.id}` };
  if (e.attemptsUsed >= e.maxAttempts) return { label: "No attempts left" };
  if (e.availableFrom && new Date(e.availableFrom) > new Date()) return { label: `Opens ${fmtDate(e.availableFrom)}` };
  if (!e.open) return { label: "Closed" };
  return { label: "View and start", className: "btn btn-primary", to: `/exams/${e.id}` };
}

export default function ExamCentre() {
  const { data, error, loading, reload } = useFetch("/exams");

  return (
    <section className="section">
      <div className="container">
        <div className="page-bar">
          <div>
            <p className="eyebrow">Examination centre</p>
            <h1>Available examinations</h1>
          </div>
          <Link to="/results" className="btn btn-secondary">My results</Link>
        </div>

        {loading && <Skeleton />}
        {error && (
          <div className="alert alert-error" role="alert">
            {error} <button type="button" className="link-btn" onClick={reload}>Try again</button>
          </div>
        )}
        {data && data.exams.length === 0 && (
          <EmptyState icon="test" title="No examinations are available right now">
            When Prime Excelerate Tutelage publishes an examination for you, it will appear here.
          </EmptyState>
        )}
        {data && data.exams.length > 0 && (
          <ul className="exam-grid">
            {data.exams.map((e) => {
              const a = action(e);
              return (
                <li key={e.id} className="exam-card card-hover">
                  <div className="exam-tags">
                    <span className="badge">{e.subject}</span>
                    {e.level && <span className="badge badge-quiet">{e.level}</span>}
                    {e.examType && <span className="badge badge-quiet">{e.examType}</span>}
                  </div>
                  <h2>{e.title}</h2>
                  {e.description && <p className="muted">{e.description}</p>}
                  <dl className="exam-facts">
                    <div><dt>Duration</dt><dd>{e.durationMinutes} min</dd></div>
                    <div><dt>Questions</dt><dd>{e.questionCount}</dd></div>
                    <div><dt>Attempts</dt><dd>{e.attemptsUsed} of {e.maxAttempts}</dd></div>
                  </dl>
                  {a.to ? <Link to={a.to} className={a.className}>{a.label}</Link> : <p className="exam-status">{a.label}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
