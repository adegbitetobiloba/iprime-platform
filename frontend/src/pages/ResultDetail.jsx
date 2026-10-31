import { useParams, Link } from "react-router-dom";
import { useFetch, fmtDate } from "../useFetch.js";
import SafeHtml from "../components/SafeHtml.jsx";

// Where an explanation came from. Shown so students can tell the document's own solution from one an administrator wrote.
const SOURCE_LABEL = { source: "From the source", admin_written: "Written by an administrator" };

export default function ResultDetail() {
  const { id } = useParams();
  const { data, error, loading } = useFetch(`/attempts/${id}/result`);

  if (loading) return <p className="page-note" role="status">Loading your result...</p>;
  if (error) {
    return (
      <section className="section"><div className="container narrow">
        <p className="alert alert-error" role="alert">{error}</p>
        <Link to="/exams">Back to examinations</Link>
      </div></section>
    );
  }
  const r = data.result;

  return (
    <section className="section">
      <div className="container narrow-wide">
        <p className="eyebrow">Result</p>
        <h1>{r.examTitle}</h1>
        <p className="muted">{r.subject} · Submitted {fmtDate(r.submittedAt)}{r.autoSubmitted ? " (time ran out, so it was submitted automatically)" : ""}</p>

        <div className="score-banner">
          <p className="score-big">{r.percentage}%</p>
          <p className="score-sub">{r.score} out of {r.totalMarks} marks</p>
        </div>

        <dl className="exam-facts exam-facts-lg">
          <div><dt>Correct</dt><dd>{r.correct}</dd></div>
          <div><dt>Incorrect</dt><dd>{r.incorrect}</dd></div>
          <div><dt>Unanswered</dt><dd>{r.unanswered}</dd></div>
          <div><dt>Questions</dt><dd>{r.questionCount}</dd></div>
        </dl>

        {data.review ? (
          <div className="review">
            <h2>Review your answers</h2>
            {data.review.map((q, i) => {
              const right = q.yourChoice === q.correctKey;
              return (
                <article key={q.id} className="review-item">
                  <p className="review-head"><strong>Question {i + 1}</strong> <span className={`badge ${right ? "badge-ok" : "badge-bad"}`}>{q.yourChoice ? (right ? "Correct" : "Incorrect") : "Not answered"}</span></p>
                  <SafeHtml html={q.textHtml} text={q.text} />
                  <ul className="review-options">
                    {q.options.map((o) => (
                      <li key={o.key} className={o.key === q.correctKey ? "is-correct" : o.key === q.yourChoice ? "is-wrong" : ""}>
                        <strong>{o.key}.</strong> <SafeHtml as="span" inline html={o.html} text={o.text} />
                        {o.key === q.correctKey && <span className="tag"> Correct answer</span>}
                        {o.key === q.yourChoice && o.key !== q.correctKey && <span className="tag"> Your answer</span>}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <div className="muted review-explanation">
                      <p><strong>Explanation:</strong>{q.explanationSource && SOURCE_LABEL[q.explanationSource] ? <span className="tag"> {SOURCE_LABEL[q.explanationSource]}</span> : null}</p>
                      <SafeHtml html={q.explanationHtml} text={q.explanation} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="note">Detailed answers are not released for this examination.</p>
        )}

        <div className="form-actions" style={{ marginTop: "var(--s5)" }}>
          <Link to="/results" className="btn btn-primary">All my results</Link>
          <Link to="/exams" className="btn btn-secondary">Examination centre</Link>
        </div>
      </div>
    </section>
  );
}
