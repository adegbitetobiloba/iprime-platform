import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import ExportBar from "../../components/analytics/ExportBar.jsx";

const pct = (v) => (v == null ? "No data" : `${v}%`);

function Card({ label, value, note }) {
  return (
    <li className="sd-stat">
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-num">{value}</span>
      {note && <span className="sd-stat-note">{note}</span>}
    </li>
  );
}

// Administrators only (the server enforces it; the route is also wrapped in AdminOnly).
export default function AdminExamAnalytics() {
  const { id } = useParams();
  const { data: d, error, loading, reload } = useFetch(`/admin/analytics/exams/${id}`);
  const peak = d ? Math.max(1, ...d.distribution.map((b) => b.count)) : 1;

  return (
    <div className="admin-page aa">
      <div className="page-bar">
        <div>
          <p className="eyebrow">Administration · Analytics</p>
          <h1>{d ? d.exam.title : "Examination analytics"}</h1>
          {d && <p className="muted">{d.exam.subject ? `${d.exam.subject} · ` : ""}Based on each student's first submitted attempt · Prepared {new Date(d.generatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
        <div className="aa-nav">
          <Link to="/admin/analytics" className="btn btn-secondary btn-sm">All analytics</Link>
          <Link to={`/admin/exams/${id}`} className="btn btn-secondary btn-sm">Back to examination</Link>
        </div>
      </div>
      <ExportBar examId={id} disabled={!d || d.participants === 0} />

      {loading && <div className="exam-card skeleton" aria-hidden="true" />}
      {error && <p className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}

      {d && d.participants === 0 && <p className="note">No student has submitted this examination yet, so there is nothing to analyse.</p>}

      {d && d.participants > 0 && (
        <>
          {d.limitedEvidence && (
            <p className="alert alert-info" role="note">Only {d.participants} student{d.participants === 1 ? " has" : "s have"} submitted. With fewer than {d.definitions.minCohort}, treat these figures as a first look and no check-in list is produced.</p>
          )}
          {d.truncated && <p className="alert alert-info" role="note">This examination has more than 5,000 attempts; only the earliest 5,000 are included.</p>}

          <ul className="sd-stats" aria-label="Summary">
            <Card label="Students" value={d.participants} note={`${d.attemptsTotal} attempts in total`} />
            <Card label="Average" value={pct(d.stats.mean)} note={`Median ${pct(d.stats.median)}`} />
            <Card label="Middle half" value={`${d.stats.q1}% – ${d.stats.q3}%`} note={`Lowest ${d.stats.min}% · highest ${d.stats.max}%`} />
            <Card label="Retook it" value={d.retakers} note={d.autoSubmitted ? `${d.autoSubmitted} timed out on their first attempt` : "None timed out"} />
          </ul>

          <section className="panel aa-block" aria-labelledby="aa-dist">
            <h2 className="panel-title" id="aa-dist">Score distribution</h2>
            <div className="aa-bars" role="img" aria-label={`Number of students in each ten-point score band: ${d.distribution.map((b) => `${b.from} to ${Math.floor(b.to)}: ${b.count}`).join("; ")}`}>
              {d.distribution.map((b) => (
                <div key={b.from} className="aa-bar" style={{ height: `${(b.count / peak) * 100}%` }}><span>{b.count}</span></div>
              ))}
            </div>
            <div className="aa-axis" aria-hidden="true">{d.distribution.map((b) => <i key={b.from}>{b.from === 90 ? "90+" : b.from}</i>)}</div>
          </section>

          <div className="aa-grid">
            <section className="panel aa-block" aria-labelledby="aa-hard">
              <h2 className="panel-title" id="aa-hard">Hardest questions</h2>
              {d.hardest.length === 0 ? <p className="muted">Question figures are not available for this examination{d.questionBasis.unverifiable ? " because it was edited after students sat it" : ""}.</p> : (
                <ul className="sd-list">
                  {d.hardest.map((q) => (
                    <li key={q.questionId} className="sd-row">
                      <div><strong>{q.text}</strong><span className="muted">{[q.topic, q.mostChosenWrong ? `most chose ${q.mostChosenWrong.key} (${q.mostChosenWrong.percent}%)` : null, q.skippedPercent ? `${q.skippedPercent}% skipped` : null].filter(Boolean).join(" · ")}</span></div>
                      <span className="badge badge-quiet">{q.percentCorrect}% correct</span>
                    </li>
                  ))}
                </ul>
              )}
              {d.questionBasis.unverifiable > 0 && d.hardest.length > 0 && <p className="muted sd-small">{d.questionBasis.unverifiable} student attempt{d.questionBasis.unverifiable === 1 ? " is" : "s are"} left out of question figures because the examination changed afterwards. Scores are unaffected.</p>}
            </section>

            <section className="panel aa-block" aria-labelledby="aa-topics">
              <h2 className="panel-title" id="aa-topics">Topics</h2>
              {d.topics.length === 0 ? <p className="muted">No topics are set on this examination's questions.</p> : (
                <ul className="sd-list">
                  {d.topics.map((t) => (
                    <li key={t.topic} className="sd-subject">
                      <div className="sd-subject-top"><strong>{t.topic}</strong><span>{t.percentage}%</span></div>
                      <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.percentage} aria-label={`${t.topic} average`}><span style={{ width: `${t.percentage}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="aa-grid">
            <section className="panel aa-block" aria-labelledby="aa-top">
              <h2 className="panel-title" id="aa-top">Top results</h2>
              <p className="muted sd-small">Students with the same score share a rank.</p>
              <ol className="aa-ranks">
                {d.top.map((r) => (
                  <li key={r.attemptId}><span className="aa-rank">{r.rank}</span><span><strong>{r.name}</strong>{r.studentId && <span className="muted"> · {r.studentId}</span>}</span><strong>{r.percentage}%</strong></li>
                ))}
              </ol>
            </section>

            <section className="panel aa-block" aria-labelledby="aa-support">
              <h2 className="panel-title" id="aa-support">Students to check in with</h2>
              <p className="muted sd-small">Under {d.definitions.supportBelow}% on their first attempt. For staff only; this is a prompt for a conversation, not a judgement.</p>
              {d.limitedEvidence ? <p className="muted">Needs at least {d.definitions.minCohort} students.</p> : d.support.length === 0 ? <p className="muted">Nobody is under {d.definitions.supportBelow}%.</p> : (
                <ul className="sd-list">
                  {d.support.map((s) => (
                    <li key={s.attemptId} className="sd-row"><div><strong>{s.name}</strong>{s.studentId && <span className="muted">{s.studentId}</span>}</div><strong>{s.percentage}%</strong></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
