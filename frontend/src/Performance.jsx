import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../useFetch.js";
import Sparkline from "../components/dashboard/Sparkline.jsx";

// Wording is deliberately neutral: no labels that stigmatise a learner.
const BAND = {
  strong: { label: "Strong", cls: "pf-band-strong" },
  developing: { label: "Developing", cls: "pf-band-developing" },
  needs_practice: { label: "Needs more practice", cls: "pf-band-practice" },
  not_enough_evidence: { label: "Not enough questions yet", cls: "pf-band-none" },
};

const mins = (s) => (s == null ? "" : s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

function Block({ id, title, note, children }) {
  return (
    <section className="sd-section" aria-labelledby={id}>
      <div className="sd-section-head"><h2 id={id}>{title}</h2></div>
      {note && <p className="muted pf-note">{note}</p>}
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="sd-card"><p className="muted pf-empty">{children}</p></div>;
}

export default function Performance() {
  const { data, error, loading, reload } = useFetch("/student/analytics");
  const d = data;
  const trend = (d?.history || []).slice(-12).map((h) => ({ id: h.attemptId, percentage: h.percentage }));
  const recent = [...(d?.history || [])].reverse().slice(0, 8);
  const topics = (d?.topics || []).filter((t) => t.topic !== "Untagged");

  return (
    <section className="section dash sd pf">
      <div className="container">
        <header className="dash-banner">
          <div>
            <p className="pill pill-on-dark">Performance</p>
            <h1>How you are doing</h1>
            <p>Worked out only from the examinations you have submitted.</p>
          </div>
          <Link to="/dashboard" className="btn btn-secondary btn-sm">Back to dashboard</Link>
        </header>

        {loading && <div className="sd-loading" aria-hidden="true"><div className="skeleton sd-sk-wide" /><div className="skeleton sd-sk-wide" /></div>}
        {error && <div className="alert alert-error sd-gap" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}

        {d && d.totals.submittedAttempts === 0 && (
          <div className="sd-card sd-empty sd-gap">
            <p className="muted">Nothing to show yet. Submit an examination and your scores, topics and progress will appear here.</p>
            <Link to="/exams" className="btn btn-primary btn-sm">Go to examinations</Link>
          </div>
        )}

        {d && d.totals.submittedAttempts > 0 && (
          <>
            <Block id="pf-trend" title="Score history" note={d.truncated ? "Showing your most recent 500 attempts." : undefined}>
              <div className="sd-card">
                {trend.length >= 2 ? <Sparkline points={trend} /> : <p className="muted pf-empty">Submit one more examination to see a trend.</p>}
                <ul className="sd-list pf-history">
                  {recent.map((h) => (
                    <li key={h.attemptId} className="sd-row">
                      <div>
                        <Link to={`/results/${h.attemptId}`}><strong>{h.examTitle}</strong></Link>
                        <span className="muted">{[h.subject, fmtDate(h.submittedAt), h.timeUsedSeconds != null ? `${mins(h.timeUsedSeconds)} used` : null, h.autoSubmitted ? "submitted when time ran out" : null].filter(Boolean).join(" · ")}</span>
                      </div>
                      <div className="sd-result-score"><strong>{h.percentage}%</strong><span className="muted">{h.correct} right · {h.incorrect} wrong · {h.unanswered} skipped</span></div>
                    </li>
                  ))}
                </ul>
              </div>
            </Block>

            <Block id="pf-topics" title="Topics" note={`A topic is only described once you have answered at least ${d.definitions.minEvidence} questions in it.`}>
              {topics.length === 0 ? (
                <Empty>Your examinations do not have topics set yet, so there is no topic breakdown.{d.untaggedQuestions ? ` (${d.untaggedQuestions} questions had no topic.)` : ""}</Empty>
              ) : (
                <ul className="sd-card pf-topics">
                  {topics.map((t) => {
                    const b = BAND[t.band];
                    return (
                      <li key={t.topic} className="sd-subject">
                        <div className="sd-subject-top"><strong>{t.topic}</strong><span className={`pf-band ${b.cls}`}>{b.label}</span></div>
                        <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.percentage} aria-label={`${t.topic} score`}><span style={{ width: `${t.percentage}%` }} /></div>
                        <span className="muted sd-small">{t.percentage}% across {t.questions} question{t.questions === 1 ? "" : "s"} in {t.attempts} attempt{t.attempts === 1 ? "" : "s"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Block>

            <Block id="pf-focus" title="Suggested revision" note="These are suggestions based on the topics above, not results.">
              {d.focus.length === 0 ? <Empty>No topic needs extra attention right now.</Empty> : (
                <ul className="sd-reco">
                  {d.focus.map((f) => (
                    <li key={f.topic} className="sd-card sd-reco-card">
                      <span className="badge badge-quiet">Suggestion</span>
                      <h3>{f.topic}</h3>
                      <p className="muted sd-small">Why: {f.basis}.</p>
                      <Link to="/exams" className="btn btn-secondary btn-sm">Find a practice exam</Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block id="pf-miss" title="Questions you keep missing" note="Questions you got wrong or skipped in two or more attempts. Correct answers are only shown where your examination allows review.">
              {d.recurringMisses.length === 0 ? <Empty>No question has been missed more than once.</Empty> : (
                <ul className="sd-card sd-list">
                  {d.recurringMisses.map((m) => (
                    <li key={`${m.examId}:${m.questionId}`} className="sd-row">
                      <div><strong>{m.text}</strong><span className="muted">{[m.examTitle, m.topic].filter(Boolean).join(" · ")}</span></div>
                      <span className="badge badge-quiet">Missed {m.timesMissed} of {m.timesSeen}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block id="pf-retest" title="Retakes">
              {d.retests.length === 0 ? <Empty>When you retake an examination, your first and latest scores are compared here.</Empty> : (
                <ul className="sd-card sd-list">
                  {d.retests.map((r) => (
                    <li key={r.examId} className="sd-row">
                      <div><strong>{r.examTitle}</strong><span className="muted">{r.attempts} attempts · first {r.firstPercentage}% · latest {r.latestPercentage}%</span></div>
                      <span className={`pf-change ${r.change > 0 ? "is-up" : r.change < 0 ? "is-down" : ""}`}>{r.change > 0 ? "+" : ""}{r.change} points</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            {d.totals.unverifiable > 0 && (
              <p className="alert alert-info sd-gap" role="note">
                {d.totals.unverifiable} of your attempt{d.totals.unverifiable === 1 ? "" : "s"} is not included in the topic and missed-question sections because the examination was changed afterwards. Your scores above are unaffected.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
