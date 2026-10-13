import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useFetch, fmtDate } from "../useFetch.js";
import { useSubmit } from "../useSubmit.js";
import FormStatus from "../components/FormStatus.jsx";

export default function ExamIntro() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch(`/exams/${id}`);

  const start = useSubmit(async () => {
    const d = await api(`/exams/${id}/start`, { method: "POST", token });
    navigate(`/attempts/${d.attempt.id}`);
    return d;
  });

  if (loading) return <p className="page-note" role="status">Loading...</p>;
  if (error) {
    return (
      <section className="section"><div className="container narrow">
        <p className="alert alert-error" role="alert">{error}</p>
        <Link to="/exams">Back to examinations</Link>
      </div></section>
    );
  }

  const e = data.exam;
  const resuming = Boolean(e.inProgressAttemptId);
  const noAttempts = !resuming && e.attemptsUsed >= e.maxAttempts;
  const notYet = e.availableFrom && new Date(e.availableFrom) > new Date();
  const canStart = resuming || (e.open && !noAttempts && !notYet);

  return (
    <section className="section">
      <div className="container narrow-wide">
        <p className="eyebrow">{e.subject}{e.level ? ` · ${e.level}` : ""}</p>
        <h1>{e.title}</h1>
        {e.description && <p className="lead">{e.description}</p>}

        <dl className="exam-facts exam-facts-lg">
          <div><dt>Duration</dt><dd>{e.durationMinutes} minutes</dd></div>
          <div><dt>Questions</dt><dd>{e.questionCount}</dd></div>
          <div><dt>Total marks</dt><dd>{e.totalMarks}</dd></div>
          <div><dt>Attempts used</dt><dd>{e.attemptsUsed} of {e.maxAttempts}</dd></div>
        </dl>

        <div className="panel">
          <h2 className="panel-title">Instructions</h2>
          <ul className="plain-list">
            {e.instructions && <li>{e.instructions}</li>}
            <li>The timer starts when you press Start and cannot be paused. It keeps running if you close the page or lose your connection.</li>
            <li>Your answers are saved as you choose them. If you refresh, you can resume the same attempt with the time that remains.</li>
            <li>Use the question numbers to move around. You can mark questions to review and come back to them.</li>
            <li>You will see a summary before you submit. When time is up, your attempt is submitted automatically.</li>
          </ul>
        </div>

        <FormStatus error={start.error} slow={start.slow} />
        <div className="form-actions" style={{ marginTop: "var(--s5)" }}>
          {canStart ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => start.run()} disabled={start.loading} aria-busy={start.loading}>
              {start.loading ? "Starting..." : resuming ? "Resume examination" : "Start examination"}
            </button>
          ) : (
            <p className="alert alert-info" role="status">
              {noAttempts ? "You have used all your attempts for this examination." : notYet ? `This examination opens ${fmtDate(e.availableFrom)}.` : "This examination is closed."}
            </p>
          )}
          <Link to="/exams" className="btn btn-secondary">Back</Link>
        </div>
      </div>
    </section>
  );
}
