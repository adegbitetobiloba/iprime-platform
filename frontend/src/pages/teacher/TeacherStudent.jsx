import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { Async, Empty, PageHead, Pill, when } from "./ui.jsx";

const BAND = { strong: ["Strong", "ok"], developing: ["Developing", "info"], needs_practice: ["Needs practice", "warn"], not_enough_evidence: ["Not enough evidence yet", undefined] };

// A small trend line from real attempt percentages (oldest on the left). No library needed.
function Spark({ values }) {
  if (values.length < 2) return <p className="muted">A trend appears after two submitted attempts.</p>;
  const w = 300, h = 70, pad = 6;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - (Math.max(0, Math.min(100, v)) / 100) * (h - pad * 2)]);
  return (
    <svg className="tch-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Scores over time: ${values.map((v) => `${Math.round(v)}%`).join(", ")}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.map((p) => p.join(",")).join(" ")} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="currentColor" />)}
    </svg>
  );
}

// One student's real results. The server decides what this teacher may see; a student who is not yours is a plain "not found".
export default function TeacherStudent() {
  const { id } = useParams();
  const d = useFetch(`/teacher/analytics/students/${id}`);
  const a = d.data;
  const history = a ? [...(a.history || [])].sort((x, y) => new Date(x.submittedAt) - new Date(y.submittedAt)) : [];

  return (
    <div className="admin-page">
      <p><Link to="/teacher/students">← My students</Link></p>
      <Async state={d}>
        {a && (
          <>
            <PageHead eyebrow={a.student.studentId} title={`${a.student.firstName} ${a.student.lastName}`}>
              {a.summary?.checkIn && <Pill tone="warn">Worth a check-in</Pill>}
            </PageHead>
            {a.scope?.restricted && <p className="note">You can see results in: <strong>{a.scope.subjects.join(", ")}</strong>. Other subjects are not shown to you.</p>}
            {a.truncated && <p className="note">Only the most recent attempts are included.</p>}

            <div className="tch-stats">
              <div className="tch-stat"><b>{a.summary?.attempts ?? 0}</b><span>Submitted attempts</span></div>
              <div className="tch-stat"><b>{a.summary?.averagePercentage ?? "–"}{a.summary?.averagePercentage != null && "%"}</b><span>Average score</span></div>
              <div className="tch-stat"><b>{a.summary?.latest ?? "–"}{a.summary?.latest != null && "%"}</b><span>Latest score</span></div>
              <div className="tch-stat"><b>{a.summary?.topicsNeedingPractice ?? 0}</b><span>Topics needing practice</span></div>
            </div>

            {history.length === 0 ? <Empty>This student has not submitted an attempt yet.</Empty> : (
              <>
                <section className="panel">
                  <h2 className="panel-title">Scores over time</h2>
                  <Spark values={history.map((h) => h.percentage)} />
                </section>

                <div className="tch-cols">
                  <section className="panel">
                    <h2 className="panel-title">By subject</h2>
                    {(a.subjects || []).length === 0 ? <p className="muted">Not enough question-level evidence yet.</p> : (
                      <ul className="tch-list">
                        {a.subjects.map((s) => (
                          <li key={s.subject} className="tch-row">
                            <div><strong>{s.subject}</strong><small>{s.questions} questions · {s.attempts} attempt{s.attempts === 1 ? "" : "s"}</small></div>
                            <div className="tch-actions"><div className="tch-bar" aria-hidden="true"><i style={{ width: `${s.percentage}%` }} /></div><b>{s.percentage}%</b></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section className="panel">
                    <h2 className="panel-title">By topic</h2>
                    {(a.topics || []).length === 0 ? <p className="muted">Topics appear when exam questions are tagged with a topic.</p> : (
                      <ul className="tch-list">
                        {a.topics.map((t) => {
                          const [label, tone] = BAND[t.band] || [t.band, undefined];
                          return (
                            <li key={t.topic} className="tch-row">
                              <div><strong>{t.topic}</strong><small>{t.percentage}% across {t.questions} questions</small></div>
                              <Pill tone={tone}>{label}</Pill>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>

                {(a.focus || []).length > 0 && (
                  <section className="panel">
                    <h2 className="panel-title">Suggested revision focus</h2>
                    <p className="muted">These are recommendations from the scores, not facts about the student.</p>
                    <ul>{a.focus.map((f) => <li key={f.topic}><strong>{f.topic}</strong>: {f.basis}</li>)}</ul>
                  </section>
                )}

                {(a.recurringMisses || []).length > 0 && (
                  <section className="panel">
                    <h2 className="panel-title">Questions missed more than once</h2>
                    <ul className="tch-list">
                      {a.recurringMisses.slice(0, 10).map((m) => (
                        <li key={`${m.examId}-${m.questionId}`} className="tch-row">
                          <div><strong>{m.text}</strong><small>{m.examTitle}{m.topic ? ` · ${m.topic}` : ""}</small></div>
                          <Pill tone="warn">Missed {m.timesMissed} of {m.timesSeen}</Pill>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="panel">
                  <h2 className="panel-title">Recent attempts</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Examination</th><th>Subject</th><th>Date</th><th>Score</th></tr></thead>
                      <tbody>
                        {[...history].reverse().slice(0, 20).map((h) => (
                          <tr key={h.attemptId}><td>{h.examTitle}</td><td>{h.subject || "–"}</td><td>{when(h.submittedAt)}</td><td>{h.score}/{h.totalMarks} ({h.percentage}%){h.autoSubmitted ? " · auto-submitted" : ""}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </Async>
    </div>
  );
}
