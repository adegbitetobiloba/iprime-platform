import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";

export default function Results() {
  const { data, error, loading, reload } = useFetch("/attempts");
  return (
    <section className="section">
      <div className="container">
        <div className="page-bar">
          <div>
            <p className="eyebrow">Examination history</p>
            <h1>My results</h1>
          </div>
          <Link to="/exams" className="btn btn-secondary">Examination centre</Link>
        </div>

        {loading && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && data.attempts.length === 0 && (
          <EmptyState icon="chart" title="No results yet" action={<Link to="/exams" className="btn btn-primary">Go to examinations</Link>}>
            When you submit an examination, your result will be recorded here.
          </EmptyState>
        )}
        {data && data.attempts.length > 0 && (
          <div className="table-wrap">
            {/* data-table--stack turns each row into a card on phones, so nothing runs off the screen (see ws5.css) */}
            <table className="data-table data-table--stack">
              <thead><tr><th>Examination</th><th>Date</th><th>Score</th><th>Percentage</th><th><span className="sr-only">Details</span></th></tr></thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="stack-title"><strong>{a.examTitle || "Examination"}</strong><br /><span className="muted">{a.subject}</span></td>
                    <td data-label="Date">{fmtDate(a.submittedAt)}</td>
                    <td data-label="Score">{a.score} / {a.totalMarks}</td>
                    <td data-label="Percentage">{a.percentage}%</td>
                    <td className="stack-action"><Link to={`/results/${a.id}`} className="stack-link">View result</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
