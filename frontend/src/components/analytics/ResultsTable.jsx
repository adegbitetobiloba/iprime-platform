import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import "../../adminResults.css";

export default function ResultsTable({ examId }) {
  const { data: d, error, loading, reload } = useFetch(`/admin/analytics/exams/${examId}/students`);
  const missing = d ? d.students.filter((s) => !s.subjects).length : 0;
  return (
    <section className="panel aa-block rs-print" aria-labelledby="rs-title">
      <div className="page-bar">
        <h2 className="panel-title" id="rs-title">Results by student</h2>
        <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => window.print()} disabled={!d || !d.students.length}>Print</button>
      </div>
      {d && <p className="rs-print-head">{d.exam.title} · {new Date(d.generatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>}
      {loading && <p className="muted" role="status">Loading results…</p>}
      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
      {d && (
        <>
          <div className="rs-wrap">
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Name</th><th>ID</th>
                  {d.subjects.map((s) => <th key={s} className="num">{s}</th>)}
                  <th className="num">Overall</th><th className="num">Marks</th>
                </tr>
              </thead>
              <tbody>
                {d.students.map((s) => (
                  <tr key={s.attemptId}>
                    <td>{s.rank}</td>
                    <td><Link to={`/admin/attempts/${s.attemptId}`}><strong>{s.name}</strong></Link>{s.timedOut ? " (timed out)" : ""}</td>
                    <td>{s.studentId || ""}</td>
                    {d.subjects.map((sub) => <td key={sub} className="num">{s.subjects && s.subjects[sub] != null ? `${s.subjects[sub]}%` : "–"}</td>)}
                    <td className="num"><strong>{s.percentage}%</strong></td>
                    <td className="num">{s.score}/{s.totalMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing > 0 && <p className="muted sd-small">Subject scores are not shown for {missing} student{missing === 1 ? "" : "s"}, because the examination was changed after they sat it. Their overall score is unaffected.</p>}
          {d.truncated && <p className="muted sd-small">Only the earliest 5,000 attempts are included.</p>}
          <p className="muted sd-small no-print">Each student's first submitted attempt. Click a name to see their questions, the order they saw them, and what they got wrong.</p>
        </>
      )}
    </section>
  );
}
