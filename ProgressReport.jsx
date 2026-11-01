import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import { useAuth } from "../auth.jsx";
import Sparkline from "../components/dashboard/Sparkline.jsx";
import { summarise } from "../lib/reportSummary.js";
import "../studentDashboard.css";
import "../performance.css";
import "../progressReport.css";

const when = (d) => d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
const pct = (v) => (v == null ? "No data" : `${v}%`);

function Item({ label, value, note }) {
  return (
    <div className="pr-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <span>{note}</span>}
    </div>
  );
}

// A one-page summary a student can print or save as a PDF and share with a parent or tutor.
// It uses only the student's own submitted results and never ranks or compares them with anyone else.
export default function ProgressReport() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch("/student/analytics");
  const r = data ? summarise(data) : null;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <section className="section pr">
      <div className="container">
        <div className="pr-tools">
          <Link to="/performance" className="btn btn-secondary btn-sm">Back to performance</Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!r || r.stats.attempts === 0}>Print or save as PDF</button>
        </div>

        {loading && <div className="sd-loading" aria-hidden="true"><div className="skeleton sd-sk-wide" /><div className="skeleton sd-sk-wide" /></div>}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}

        {r && (
          <article className="pr-sheet" aria-labelledby="pr-title">
            <header className="pr-head">
              <p className="pr-org">Prime Excelerate Tutelage · iPrime</p>
              <h1 id="pr-title">Progress report</h1>
              <dl className="pr-who">
                <div><dt>Student</dt><dd>{name || "Student"}</dd></div>
                {user?.studentId && <div><dt>Student ID</dt><dd>{user.studentId}</dd></div>}
                <div><dt>Prepared</dt><dd>{when(new Date())}</dd></div>
              </dl>
            </header>

            <p className="pr-lead">{r.headline}</p>

            {r.stats.attempts === 0 ? (
              <p className="muted">Once examinations have been submitted on iPrime, this page will summarise the results.</p>
            ) : (
              <>
                <dl className="pr-facts" aria-label="Summary">
                  <Item label="Examinations submitted" value={r.stats.attempts} note={`${r.stats.examsTaken} different exam${r.stats.examsTaken === 1 ? "" : "s"}`} />
                  <Item label="Average score" value={pct(r.stats.average)} />
                  <Item label="Best score" value={pct(r.stats.best)} />
                  <Item label="Latest score" value={pct(r.stats.latest)} note={r.stats.changeFromEarlier == null ? undefined : `${r.stats.changeFromEarlier > 0 ? "+" : ""}${r.stats.changeFromEarlier} points against the earlier average`} />
                </dl>

                {r.trend.length >= 2 && (
                  <section className="pr-block" aria-labelledby="pr-trend">
                    <h2 id="pr-trend">Recent results</h2>
                    <Sparkline points={r.trend} />
                  </section>
                )}

                {r.subjects.length > 0 && (
                  <section className="pr-block" aria-labelledby="pr-subjects">
                    <h2 id="pr-subjects">By subject</h2>
                    <table className="pr-table">
                      <thead><tr><th scope="col">Subject</th><th scope="col">Attempts</th><th scope="col">Average</th><th scope="col">Best</th></tr></thead>
                      <tbody>{r.subjects.map((s) => <tr key={s.subject}><th scope="row">{s.subject}</th><td>{s.attempts}</td><td>{s.average}%</td><td>{s.best}%</td></tr>)}</tbody>
                    </table>
                  </section>
                )}

                <div className="pr-cols">
                  <section className="pr-block" aria-labelledby="pr-strong">
                    <h2 id="pr-strong">Going well</h2>
                    {r.strengths.length === 0 ? <p className="muted">Strong topics appear here once enough questions have been answered in a topic.</p> : (
                      <ul>{r.strengths.map((t) => <li key={t.topic}><strong>{t.topic}</strong> <span className="muted">{t.percentage}% across {t.questions} questions</span></li>)}</ul>
                    )}
                    {r.improved.length > 0 && (
                      <>
                        <h3>Improved on a retake</h3>
                        <ul>{r.improved.map((x) => <li key={x.examId}><strong>{x.examTitle}</strong> <span className="muted">up {x.change} points ({x.firstPercentage}% to {x.latestPercentage}%)</span></li>)}</ul>
                      </>
                    )}
                  </section>
                  <section className="pr-block" aria-labelledby="pr-next">
                    <h2 id="pr-next">Suggested next steps</h2>
                    {r.nextSteps.length === 0 ? <p className="muted">No topic needs extra attention at the moment.</p> : (
                      <ul>{r.nextSteps.map((t) => <li key={t.topic}>Spend extra time on <strong>{t.topic}</strong> <span className="muted">({t.percentage}% across {t.questions} questions)</span></li>)}</ul>
                    )}
                    <p className="muted pr-small">These are suggestions based on the results above, not marks.</p>
                  </section>
                </div>
              </>
            )}

            <footer className="pr-foot">
              <h2>How to read this report</h2>
              <ul>
                <li>It is based only on examinations this student submitted on iPrime. It is not a certificate or an official academic record.</li>
                <li>It compares the student with their own earlier work, never with other students.</li>
                <li>A topic is only described once at least {data.definitions.minEvidence} questions in it have been answered.</li>
                {data.totals.unverifiable > 0 && <li>{data.totals.unverifiable} attempt{data.totals.unverifiable === 1 ? " is" : "s are"} left out of the topic notes because the examination was changed afterwards. Scores are unaffected.</li>}
              </ul>
            </footer>
          </article>
        )}
      </div>
    </section>
  );
}
