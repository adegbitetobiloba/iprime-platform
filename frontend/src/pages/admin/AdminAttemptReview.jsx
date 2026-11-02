import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch, fmtDate } from "../../useFetch.js";
import SafeHtml from "../../components/SafeHtml.jsx";
import "./builder.css";

const mins = (s) => { const m = Math.floor(s / 60), r = s % 60; return m ? `${m} min${r ? ` ${r} s` : ""}` : `${r} s`; };
const FILTERS = [["all", "All"], ["wrong", "Wrong"], ["right", "Right"], ["blank", "Unanswered"], ["flagged", "Flagged"]];

// The examiner's view of ONE attempt: the questions this student was given, in the order and with the letters they saw.
export default function AdminAttemptReview() {
  const { id } = useParams();
  const { data, error, loading } = useFetch(`/admin/attempts/${id}`);
  const [filter, setFilter] = useState("all");
  const shown = useMemo(() => {
    if (!data) return [];
    const pick = { all: () => true, wrong: (q) => q.correct === false, right: (q) => q.correct === true, blank: (q) => !q.answered, flagged: (q) => q.flagged }[filter];
    return data.questions.map((q, i) => ({ ...q, n: i + 1 })).filter(pick);
  }, [data, filter]);

  if (loading) return <p className="page-note" role="status">Loading attempt...</p>;
  if (error) return <div className="admin-page"><p className="alert alert-error" role="alert">{error}</p><p><Link to="/admin/attempts">← All attempts</Link></p></div>;
  const { attempt: a, student: s, exam: e } = data;
  const counts = { wrong: data.questions.filter((q) => q.correct === false).length, right: data.questions.filter((q) => q.correct === true).length, blank: data.questions.filter((q) => !q.answered).length };

  return (
    <div className="admin-page">
      <p><Link to={`/admin/attempts?exam=${e.id}`}>← Attempts for {e.title}</Link></p>
      <div className="page-bar"><div><p className="eyebrow">Attempt</p><h1>{s.name}</h1><p className="muted">{[s.studentId, s.email].filter(Boolean).join(" · ")}</p></div></div>

      <dl className="xb-summary">
        <div><dt>Examination</dt><dd>{e.title}</dd></div>
        <div><dt>Status</dt><dd>{a.status === "submitted" ? "Submitted" : "In progress"}{a.autoSubmitted ? " (time ran out)" : ""}</dd></div>
        <div><dt>Score</dt><dd>{a.percentage !== null ? `${a.percentage}% (${a.score} / ${a.totalMarks})` : "Not marked yet"}</dd></div>
        <div><dt>Right / wrong / blank</dt><dd>{counts.right} / {counts.wrong} / {counts.blank}</dd></div>
        <div><dt>Started</dt><dd>{fmtDate(a.startedAt)}</dd></div>
        <div><dt>Time used</dt><dd>{mins(a.timeUsedSeconds)}</dd></div>
      </dl>
      {data.drawn && <p className="note">This student's own draw: <strong>{data.questions.length}</strong> questions picked for them from a pool of {e.poolSize}. Other students were given different questions.</p>}
      {(a.shuffledQuestions || a.shuffledOptions) && <p className="muted xb-help">Shown exactly as the student saw it: {a.shuffledQuestions ? "their own question order" : ""}{a.shuffledQuestions && a.shuffledOptions ? " and " : ""}{a.shuffledOptions ? "their own option order, so the letters here are the letters they saw" : ""}.</p>}

      <div className="xb-chips" role="group" aria-label="Show">
        {FILTERS.map(([k, t]) => <button key={k} type="button" className={`xb-chip${filter === k ? " is-on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>)}
      </div>
      {shown.length === 0 && <p className="note">No questions in this view.</p>}
      <ol className="xb-qlist" style={{ listStyle: "none" }}>
        {shown.map((q) => (
          <li key={q.id} className="xb-q xb-review">
            <div>
              <p><strong>Question {q.n}</strong>{" "}
                <span className={`badge ${q.correct === true ? "badge-ok" : q.correct === false ? "badge-bad" : "badge-quiet"}`}>{q.correct === true ? "Correct" : q.correct === false ? "Wrong" : "Not answered"}</span>
                {q.flagged && <span className="badge badge-quiet"> Flagged</span>}</p>
              <SafeHtml html={q.textHtml} text={q.text} />
              <ul className="xb-opts">
                {q.options.map((o) => (
                  <li key={o.key} className={o.key === q.correctKey ? "is-correct" : o.key === q.yourChoice ? "is-wrong" : ""}>
                    <strong>{o.label}.</strong> <SafeHtml as="span" inline html={o.html} text={o.text} />
                    {o.key === q.correctKey && <span className="tag"> Correct answer</span>}
                    {o.key === q.yourChoice && <span className="tag"> Student's answer</span>}
                  </li>
                ))}
              </ul>
              {q.explanation && <div className="muted xb-help"><strong>Explanation:</strong> <SafeHtml html={q.explanationHtml} text={q.explanation} /></div>}
              <div className="meta">{[q.topic, q.difficulty, `${q.marks} mark${q.marks === 1 ? "" : "s"}`].filter(Boolean).map((m) => <span key={m}>{m}</span>)}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
