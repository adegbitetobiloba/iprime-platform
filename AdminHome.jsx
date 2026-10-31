import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";

// Every number comes from the API (counts of real records). Same data as before, grouped by job.
function Group({ title, items }) {
  return (
    <section className="adm-section">
      <h2>{title}</h2>
      <ul className="adm-cards">
        {items.map(([label, value, to]) => (
          <li key={label} className="adm-card">
            {to ? <Link to={to}><span className="adm-card-num">{value}</span><span className="adm-card-label">{label}</span></Link>
              : <><span className="adm-card-num">{value}</span><span className="adm-card-label">{label}</span></>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminHome() {
  const { data, error, loading, reload } = useFetch("/admin/overview");
  const apps = useFetch("/admin/enrolments/summary");
  const submitted = apps.data?.counts?.submitted || 0;

  return (
    <div className="admin-page">
      <header className="adm-head"><div><p className="eyebrow">Administration</p><h1>Overview</h1><p>What needs attention now, and how the centre is doing.</p></div></header>

      {(submitted > 0 || (data && data.pendingStudents > 0)) && (
        <section aria-label="Needs attention" className="adm-section" style={{ marginTop: 0 }}>
          <h2>Needs attention</h2>
          {submitted > 0 && (
            <div className="callout" role="status"><p><strong>{submitted} application{submitted === 1 ? " is" : "s are"} waiting for review.</strong></p><Link to="/admin/applications" className="btn btn-primary btn-sm">Review applications</Link></div>
          )}
          {data && data.pendingStudents > 0 && (
            <div className="callout" role="status"><p><strong>{data.pendingStudents} student account{data.pendingStudents === 1 ? " is" : "s are"} waiting for approval.</strong> They cannot log in until approved.</p><Link to="/admin/students?approval=pending" className="btn btn-primary btn-sm">Review accounts</Link></div>
          )}
          {data && data.pendingAlumni > 0 && (
            <div className="callout" role="status"><p><strong>{data.pendingAlumni} alumni request{data.pendingAlumni === 1 ? " is" : "s are"} waiting for review.</strong></p><Link to="/admin/students" className="btn btn-secondary btn-sm">Open accounts</Link></div>
          )}
        </section>
      )}

      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {data && (
        <>
          <Group title="Admissions" items={[["Applications waiting", submitted, "/admin/applications"], ["Accounts waiting for approval", data.pendingStudents, "/admin/students?approval=pending"], ["Alumni waiting for review", data.pendingAlumni, "/admin/students"]]} />
          <Group title="People" items={[["Students", data.students, "/admin/students"], ["Verified students", data.verifiedStudents], ["Parents and guardians", data.parents], ["Alumni", data.alumni]]} />
          <Group title="Examinations" items={[["Examinations", data.exams, "/admin/exams"], ["Published examinations", data.publishedExams], ["Questions in total", data.questions], ["Submitted attempts", data.submittedAttempts], ["Attempts in the last 7 days", data.attemptsLast7Days]]} />
          <Group title="Programmes" items={[["Published programmes", data.publishedProgrammes, "/admin/programmes"]]} />
          {data.students === 0 && data.exams === 0 && <p className="note">Nothing has been recorded yet. Figures appear here as students register and examinations are created.</p>}
        </>
      )}
    </div>
  );
}
