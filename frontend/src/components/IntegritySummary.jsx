import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";

const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

function Card({ label, value, note }) {
  return (
    <li className="sd-stat">
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-num">{value}</span>
      {note && <span className="sd-stat-note">{note}</span>}
    </li>
  );
}

// Integrity roll-up for one examination, for the analytics page. Counts every sitting (including retakes) and never changes
// a score: it only points staff to the attempts worth a look. Administrators only (the server enforces it).
export default function IntegritySummary({ examId }) {
  const { data, error, loading } = useFetch(`/admin/integrity/exams/${examId}`);
  if (loading) return <div className="exam-card skeleton" aria-hidden="true" />;
  if (error) return <p className="alert alert-error" role="alert">Integrity figures could not be loaded: {error}</p>;
  const s = data.summary;
  const guard = data.exam.guard;
  const share = s.attempts ? Math.round((s.withWarnings / s.attempts) * 100) : 0;

  return (
    <section className="panel aa-block" aria-labelledby="aa-integrity">
      <h2 className="panel-title" id="aa-integrity">Exam integrity</h2>
      <p className="muted sd-small">
        {guard.enabled
          ? `ExamGuard is on for this examination: ${guard.maxViolations} warning${guard.maxViolations === 1 ? "" : "s"} allowed${guard.autoSubmit ? ", then automatic submission" : ", no automatic submission"}.`
          : "ExamGuard is switched off for this examination now, so attempts started from now on are not monitored."}{" "}
        It reports what the student&apos;s browser could see. Treat it as a prompt to look, not as proof, and it never changes a score.
      </p>

      <ul className="sd-stats" aria-label="Integrity summary">
        <Card label="Sittings" value={s.attempts} note={`${s.submitted} submitted`} />
        <Card label="With warnings" value={s.withWarnings} note={`${share}% of sittings · ${s.totalWarnings} warnings in total`} />
        <Card label="Submitted for warnings" value={s.autoSubmittedByWarnings} note="Reached the warning limit" />
        <Card label="Sent after reconnecting" value={s.lateSynced} note={`Average time away ${secs(s.avgAwaySeconds)}`} />
      </ul>

      <p className="muted sd-small">
        Warnings per sitting: none {s.distribution.none} · one {s.distribution.one} · two {s.distribution.two} · three or more {s.distribution.threePlus}
      </p>

      {s.needsReview.length === 0 ? (
        <p className="muted">No sitting has warnings or late-sent answers.</p>
      ) : (
        <>
          <h3>Worth a look</h3>
          <ul className="sd-list">
            {s.needsReview.map((r) => (
              <li key={r.id} className="sd-row">
                <div>
                  <strong>{r.student}</strong>{r.studentId && <span className="muted"> · {r.studentId}</span>}
                  <span className="muted">{r.reasons.join(" · ")}{r.awaySeconds ? ` · away ${secs(r.awaySeconds)}` : ""}</span>
                </div>
                <strong>{r.percentage == null ? "—" : `${r.percentage}%`}</strong>
              </li>
            ))}
          </ul>
          <p className="sd-small"><Link to={`/admin/exams/${examId}`}>Open the examination page to see each timeline</Link></p>
        </>
      )}
    </section>
  );
}
