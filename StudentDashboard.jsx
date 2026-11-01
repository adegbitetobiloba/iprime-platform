import { Link } from "react-router-dom";
import { useFetch, fmtDate } from "../useFetch.js";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import Sparkline from "../components/dashboard/Sparkline.jsx";
import "../studentDashboard.css";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const minutesLeft = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min left` : `${Math.max(1, Math.ceil(s / 60))} min left`);

function Stat({ label, value, note, tone }) {
  return (
    <li className="sd-stat">
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-num">{value}</span>
      {note && <span className={`sd-stat-note ${tone || ""}`}>{note}</span>}
    </li>
  );
}

function Section({ id, title, action, children }) {
  return (
    <section className="sd-section" aria-labelledby={id}>
      <div className="sd-section-head">
        <h2 id={id}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const NAV = [
  { to: "/exams", icon: "test", label: "Take an examination", hint: "See what is open for you" },
  { to: "/exams", icon: "book", label: "Practise questions", hint: "Open practice tests and timed papers" },
  { to: "/results", icon: "clock", label: "Examination history", hint: "Every result you have saved" },
  { to: "/performance", icon: "chart", label: "Performance", hint: "Scores, topics and progress" },
  { icon: "book", label: "Library", hint: "Coming soon", soon: true },
  { to: "/account", icon: "user", label: "My profile", hint: "Update your details" },
];

function QuickNav() {
  return (
    <nav className="sd-nav" aria-label="Quick navigation">
      <ul>
        {NAV.map((n) => (
          <li key={n.label}>
            {n.soon ? (
              <span className="sd-nav-item is-soon" aria-disabled="true">
                <span className="icon-tile icon-tile-sm"><Icon name={n.icon} size={18} /></span>
                <span><strong>{n.label}</strong><small>{n.hint}</small></span>
              </span>
            ) : n.anchor ? (
              <a className="sd-nav-item" href={n.to}>
                <span className="icon-tile icon-tile-sm"><Icon name={n.icon} size={18} /></span>
                <span><strong>{n.label}</strong><small>{n.hint}</small></span>
              </a>
            ) : (
              <Link className="sd-nav-item" to={n.to}>
                <span className="icon-tile icon-tile-sm"><Icon name={n.icon} size={18} /></span>
                <span><strong>{n.label}</strong><small>{n.hint}</small></span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ContinueLearning({ data }) {
  const running = data.continueExams;
  const lib = data.library;
  const topSubjects = data.subjects.slice(0, 3);
  return (
    <Section id="sd-continue" title="Continue learning">
      <div className="sd-continue">
        <div className="sd-card">
          <h3>Unfinished examinations</h3>
          {running.length === 0 ? (
            <p className="muted">Nothing is waiting for you. Examinations you start but have not submitted will appear here.</p>
          ) : (
            <ul className="sd-list">
              {running.map((r) => (
                <li key={r.attemptId} className="sd-row">
                  <div>
                    <strong>{r.examTitle}</strong>
                    <span className="muted">{[r.subject, r.answered != null && r.questionCount ? `${r.answered} of ${r.questionCount} answered` : null].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="sd-row-end">
                    <span className="badge badge-quiet">{minutesLeft(r.secondsLeft)}</span>
                    <Link className="btn btn-primary btn-sm" to={`/attempts/${r.attemptId}`}>Resume</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sd-card">
          <h3>Library</h3>
          {lib?.available && lib.recent?.length > 0 ? (
            <ul className="sd-list">
              {lib.recent.map((m) => (
                <li key={m.id} className="sd-row">
                  <div>
                    <strong>{m.title}</strong>
                    <span className="muted">{[m.subject, m.lastPage && m.pageCount ? `Page ${m.lastPage} of ${m.pageCount}` : null].filter(Boolean).join(" · ")}</span>
                  </div>
                  {m.href && <Link className="btn btn-secondary btn-sm" to={m.href}>Continue</Link>}
                </li>
              ))}
            </ul>
          ) : lib?.available ? (
            <p className="muted">You have not opened any study material yet.</p>
          ) : (
            <p className="muted">The Library is not open yet. When it is, the lessons and PDFs you read will appear here so you can carry on from the page where you stopped.</p>
          )}
        </div>

        <div className="sd-card">
          <h3>Subjects you have practised</h3>
          {topSubjects.length === 0 ? (
            <p className="muted">Submit an examination and your subjects will be listed here.</p>
          ) : (
            <ul className="sd-list">
              {topSubjects.map((s) => (
                <li key={s.subject} className="sd-row">
                  <div><strong>{s.subject}</strong><span className="muted">{s.attempts} attempt{s.attempts === 1 ? "" : "s"}</span></div>
                  <Link className="btn btn-secondary btn-sm" to="/exams">Practise</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function Performance({ data }) {
  const { stats, progress, subjects } = data;
  const series = progress.series;
  return (
    <div id="performance" className="sd-anchor">
      <Section id="sd-progress" title="Learning progress">
        <div className="sd-progress">
          <div className="sd-card">
            <h3>Your recent results</h3>
            {series.length >= 2 ? <Sparkline points={series} /> : (
              <p className="muted">{series.length === 1 ? "Complete one more examination to see your trend." : "Your trend will appear after you submit your first examinations."}</p>
            )}
          </div>
          <div className="sd-card">
            <h3>Examinations tried</h3>
            {progress.coveragePercent === null ? (
              <p className="muted">There are no open examinations at the moment.</p>
            ) : (
              <>
                <p className="sd-big">{progress.openExaminationsTried} <span>of {progress.openExaminations} open</span></p>
                <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.coveragePercent} aria-label="Open examinations you have tried">
                  <span style={{ width: `${progress.coveragePercent}%` }} />
                </div>
                <p className="muted sd-small">{stats.attempted === 0 ? "Start with any open examination." : "Examinations you have submitted at least once."}</p>
              </>
            )}
          </div>
        </div>
        {subjects.length > 0 && (
          <div className="sd-card sd-subjects">
            <h3>By subject</h3>
            <ul className="sd-list">
              {subjects.map((s) => (
                <li key={s.subject} className="sd-subject">
                  <div className="sd-subject-top"><strong>{s.subject}</strong><span>{s.average}% average</span></div>
                  <div className="sd-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.average} aria-label={`${s.subject} average`}><span style={{ width: `${s.average}%` }} /></div>
                  <span className="muted sd-small">{s.attempts} attempt{s.attempts === 1 ? "" : "s"} · best {s.best}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}

function Recent({ data }) {
  return (
    <Section id="sd-recent" title="Recent results" action={data.recent.length > 0 && <Link to="/results" className="sd-link">View all <Icon name="arrow" size={14} /></Link>}>
      {data.recent.length === 0 ? (
        <div className="sd-card sd-empty">
          <p className="muted">You have not submitted an examination yet. Your results will be listed here.</p>
          <Link to="/exams" className="btn btn-primary btn-sm">Go to examinations</Link>
        </div>
      ) : (
        <ul className="sd-results">
          {data.recent.map((r) => (
            <li key={r.id}>
              <Link to={`/results/${r.id}`} className="sd-result">
                <span className="sd-result-main"><strong>{r.examTitle}</strong><span className="muted">{[r.subject, fmtDate(r.submittedAt)].filter(Boolean).join(" · ")}</span></span>
                <span className="sd-result-score"><strong>{r.percentage}%</strong><span className="muted">{r.score} / {r.totalMarks}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Recommended({ data }) {
  return (
    <Section id="sd-reco" title="Recommended for you" action={<Link to="/exams" className="sd-link">All examinations <Icon name="arrow" size={14} /></Link>}>
      {data.recommended.length === 0 ? (
        <div className="sd-card"><p className="muted">No examinations are open for you right now. When one is published, it will be suggested here.</p></div>
      ) : (
        <ul className="sd-reco">
          {data.recommended.map((e) => (
            <li key={e.id} className="sd-card sd-reco-card">
              <div className="exam-tags">
                <span className="badge">{e.subject}</span>
                {e.examType && <span className="badge badge-quiet">{e.examType}</span>}
              </div>
              <h3>{e.title}</h3>
              <p className="muted sd-small">{e.durationMinutes} min · {e.questionCount} questions · attempt {e.attemptsUsed + 1} of {e.maxAttempts}</p>
              <p className="sd-why">{e.reason}</p>
              <Link to={`/exams/${e.id}`} className="btn btn-secondary btn-sm">View and start</Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Skeleton() {
  return (
    <div className="sd-loading" aria-hidden="true">
      <div className="skeleton sd-sk-wide" />
      <div className="sd-sk-grid">{[1, 2, 3, 4].map((n) => <div key={n} className="skeleton" />)}</div>
      <div className="skeleton sd-sk-wide" />
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch("/student/dashboard");
  const s = data?.stats;
  const change = s?.changeFromEarlier;

  return (
    <section className="section dash sd">
      <div className="container">
        <header className="dash-banner reveal">
          <div>
            <p className="pill pill-on-dark">Student{user?.studentId ? ` · ${user.studentId}` : ""}</p>
            <h1>{greeting()}, {user?.firstName}</h1>
            <p>{data?.continueExams?.length ? "You have an examination waiting. Pick up where you stopped." : "Here is where you stand and what to do next."}</p>
          </div>
          {user?.isVerified && <span className="status-ok"><Icon name="check" size={16} /> Email verified</span>}
        </header>

        {(!user?.phone || !user?.state) && (
          <p className="alert alert-info sd-gap" role="status">Add your phone number and state to finish your profile. <Link to="/account">Edit profile</Link></p>
        )}

        <QuickNav />

        {loading && <Skeleton />}
        {error && <div className="alert alert-error sd-gap" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}

        {data && (
          <>
            <Reveal>
              <ul className="sd-stats" aria-label="Your examination summary">
                <Stat label="Examinations attempted" value={s.attempted} note={s.attempted ? `${s.examsTaken} different exam${s.examsTaken === 1 ? "" : "s"}` : "None yet"} />
                <Stat label="Average score" value={s.averagePercentage === null ? "No data" : `${s.averagePercentage}%`} note={s.attempted ? "Across all attempts" : "Submit an exam to see this"} />
                <Stat label="Best score" value={s.bestPercentage === null ? "No data" : `${s.bestPercentage}%`} />
                <Stat label="Latest result" value={s.latestPercentage === null ? "No data" : `${s.latestPercentage}%`}
                  note={change === null ? null : change === 0 ? "Same as your earlier average" : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} points on your earlier average`}
                  tone={change === null ? "" : change > 0 ? "is-up" : change < 0 ? "is-down" : ""} />
              </ul>
            </Reveal>

            <ContinueLearning data={data} />
            <Performance data={data} />
            <Recent data={data} />
            <Recommended data={data} />
          </>
        )}
      </div>
    </section>
  );
}
