import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";

// Who downloaded which results file, and when. Accountability for a sensitive action; admins only (server enforced).
// If the log cannot be loaded the panel is hidden, so the page around it still works.
export default function RecentExports() {
  const { data, error, loading } = useFetch("/admin/analytics/exports");
  if (loading) return <div className="exam-card skeleton" aria-hidden="true" style={{ minHeight: 80 }} />;
  if (error || !data) return null;

  return (
    <section className="aa-block" aria-labelledby="aa-exports">
      <h2 id="aa-exports" style={{ fontSize: "1.1rem", marginBottom: 4 }}>Recent downloads</h2>
      <p className="muted" style={{ marginTop: 0 }}>Every results download is recorded here with who made it.</p>
      {data.exports.length === 0 ? <p className="note">No results have been downloaded yet.</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>When</th><th>Examination</th><th>Rows</th><th>Downloaded by</th></tr></thead>
            <tbody>
              {data.exports.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.at)}</td>
                  <td><Link to={`/admin/exams/${e.examId}/analytics`}>{e.examTitle}</Link></td>
                  <td>{e.rows}</td>
                  <td>{e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
