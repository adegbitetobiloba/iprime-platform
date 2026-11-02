import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import "../../library/library.css";

function Table({ title, note, rows, cols, empty }) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>{title}</h2>
      {note && <p className="muted" style={{ marginTop: 0 }}>{note}</p>}
      {rows.length === 0 ? <p className="note">{empty}</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}>{cols.map((c) => <td key={c.label}>{c.render(r)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminLibraryAnalytics() {
  const { data, error, loading, reload } = useFetch("/admin/library/analytics");
  const t = data && data.totals;
  return (
    <div className="admin-page">
      <p className="lib-crumbs"><Link to="/admin/library">Library</Link> › Learning analytics</p>
      <div className="page-bar"><div><p className="eyebrow">Administration</p><h1>Learning analytics</h1></div></div>
      <p className="muted">Every figure comes from recorded student activity. With no activity yet, the lists are empty.</p>
      {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
      {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
      {data && (
        <>
          <div className="lib-stat-grid">
            <div className="lib-stat"><strong>{t.enrolments}</strong>course enrolments</div>
            <div className="lib-stat"><strong>{t.activeLearners30d}</strong>active learners (30 days)</div>
            <div className="lib-stat"><strong>{t.lessonsCompleted}</strong>lessons completed</div>
            <div className="lib-stat"><strong>{t.courseCompletionRate}%</strong>course completion rate</div>
            <div className="lib-stat"><strong>{t.coursesByStatus.published || 0}</strong>published courses</div>
          </div>
          <Table title="Most accessed courses" rows={data.topCourses} empty="No student has started a course yet."
            cols={[{ label: "Course", render: (r) => r.title }, { label: "Enrolments", render: (r) => r.enrolments }, { label: "Completed", render: (r) => `${r.completions} (${r.completionRate}%)` }]} />
          <Table title="Most viewed lessons" rows={data.mostViewedLessons} empty="No lessons have been opened yet."
            cols={[{ label: "Lesson", render: (r) => r.title }, { label: "Course", render: (r) => r.course }, { label: "Views", render: (r) => r.opens }, { label: "Students", render: (r) => r.openers }, { label: "Completion", render: (r) => `${r.completionRate}%` }]} />
          <Table title="Where students stop" note={`Lessons opened by at least ${data.minOpeners} students, lowest completion first.`} rows={data.dropOff} empty={`No lesson has been opened by ${data.minOpeners} or more students yet.`}
            cols={[{ label: "Lesson", render: (r) => r.title }, { label: "Course", render: (r) => r.course }, { label: "Opened by", render: (r) => r.openers }, { label: "Completed", render: (r) => `${r.completers} (${r.completionRate}%)` }]} />
          <Table title="Video engagement" note="Average share of each video that students have watched." rows={data.videoEngagement} empty="No video progress has been recorded yet."
            cols={[{ label: "Video lesson", render: (r) => r.title }, { label: "Viewers", render: (r) => r.viewers }, { label: "Average watched", render: (r) => `${r.avgWatchedPercent}%` }]} />
          <Table title="Practice after lessons" rows={data.practice} empty="No lesson has a practice exam attached."
            cols={[{ label: "Lesson", render: (r) => r.title }, { label: "Students", render: (r) => r.openers }, { label: "Passed practice", render: (r) => `${r.passed} (${r.passRate}%)` }]} />
        </>
      )}
    </div>
  );
}
