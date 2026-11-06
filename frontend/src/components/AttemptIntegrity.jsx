import { useState } from "react";
import { useFetch, fmtDate } from "../useFetch.js";

const REASON = { student: "Submitted", time_up: "Submitted (time up)", violation_limit: "Submitted automatically (warning limit reached)", admin_forced: "Submitted by an administrator", admin_terminated: "Ended by an administrator" };
const TYPE = {
  exam_started: "Examination started", exam_resumed: "Resumed", submitted: "Submitted by the student",
  auto_submitted_time: "Submitted automatically (time up)", auto_submitted_violations: "Submitted automatically (warning limit)",
  answers_synced_late: "Answers sent after reconnecting", away: "Left the exam tab or window", fullscreen_exit: "Left fullscreen",
  fullscreen_enter: "Entered fullscreen", fullscreen_unsupported: "Fullscreen not supported by this browser", offline: "Internet connection lost",
  online: "Internet connection back", copy_blocked: "Tried to copy", paste_blocked: "Tried to paste", contextmenu_blocked: "Tried the right-click menu",
  select_blocked: "Tried to select text", print_blocked: "Tried to print", shortcut_blocked: "Tried a copy, select-all or print shortcut",
  admin_paused: "Paused by an administrator", admin_resumed: "Resumed by an administrator", time_extended: "Time added by an administrator",
  admin_force_requested: "Administrator asked the screen to submit", admin_force_submitted: "Submitted by an administrator", admin_terminated: "Ended by an administrator", closed_by_admin: "Attempt closed by an administrator",
  edge_swipe: "Swiped down from the top edge (possible notification panel)",
};
const secs = (ms) => (ms == null ? "" : ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${Math.round(ms / 1000)} s`);
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

function Timeline({ attemptId }) {
  const { data, error, loading } = useFetch(`/admin/integrity/attempts/${attemptId}/events`);
  if (loading) return <p className="muted">Loading the timeline...</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  const events = data?.events || [];
  if (!events.length) return <p className="note">Nothing was recorded for this attempt (it may have been taken before activity logging existed).</p>;
  return (
    <ol className="plain-list">
      {events.map((e) => (
        <li key={e.id}>
          <strong>{clock(e.at)}</strong> &middot; {TYPE[e.type] || e.type}
          {e.durationMs != null ? ` (${secs(e.durationMs)})` : ""}
          {e.counted ? <strong> &middot; counted as a warning</strong> : ""}
        </li>
      ))}
    </ol>
  );
}

// Attempts for one examination, with the integrity facts an administrator reviews: warnings, time away, automatic
// submission and answers sent late. Replaces the plain attempts table on the exam edit page.
export default function AttemptIntegrity({ examId }) {
  const { data, error, loading } = useFetch(`/admin/integrity/exams/${examId}`);
  const [open, setOpen] = useState(null);
  const rows = data?.attempts || [];
  const guard = data?.exam?.guard;

  return (
    <div className="panel">
      <h2 className="panel-title">Attempts and integrity</h2>
      {guard && (
        <p className="muted">
          {guard.enabled
            ? `ExamGuard is on: ${guard.maxViolations} warning${guard.maxViolations === 1 ? "" : "s"} allowed${guard.autoSubmit ? ", then the exam is submitted automatically" : " (no automatic submission)"}.`
            : "ExamGuard is off for this examination."}
        </p>
      )}
      {data && typeof data.retentionDays === "number" && (
        <p className="muted">{data.retentionDays > 0 ? `Activity records are kept for ${data.retentionDays} days, then deleted. Results are never deleted.` : "Activity records are kept indefinitely. Results are never deleted."}</p>
      )}
      {loading && <p className="muted">Loading...</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="note">No attempts yet.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Student</th><th>Status</th><th>Score</th><th>Warnings</th><th>Time away</th><th>Started</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.student}</strong><br /><span className="muted">{a.studentId}</span></td>
                  <td>
                    {a.status === "submitted" ? (REASON[a.submitReason] || (a.autoSubmitted ? "Submitted (time up)" : "Submitted")) : "In progress"}
                    {a.lateSynced && <><br /><span className="muted">Answers sent after reconnecting ({a.lateSyncedCount} accepted{a.lateSyncRejected ? `, ${a.lateSyncRejected} refused` : ""})</span></>}
                  </td>
                  <td>{a.status === "submitted" ? `${a.score} / ${a.totalMarks} (${a.percentage}%)` : "—"}</td>
                  <td>{a.violations > 0 ? <strong>{a.violations} of {a.maxViolations}</strong> : "0"}</td>
                  <td>{a.awaySeconds ? secs(a.awaySeconds * 1000) : "—"}</td>
                  <td>{fmtDate(a.startedAt)}</td>
                  <td><button type="button" className="link-btn" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Hide timeline" : "Timeline"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {open && <div className="note"><h3>Timeline</h3><Timeline attemptId={open} /></div>}
        </div>
      )}
    </div>
  );
}
