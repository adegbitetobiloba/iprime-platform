import { Link } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { useFetch, fmtDate } from "../../useFetch.js";
import Icon from "../../components/Icon.jsx";
import { TYPE_LABEL as ROLE_LABEL, ALUMNI_STATUS } from "../../accountTypes.js";

function Banner({ user, children }) {
  return (
    <section className="home-banner">
      <div className="container home-banner-inner reveal">
        <div>
          <p className="pill pill-on-dark">{ROLE_LABEL[user.role] || user.role}{user.studentId ? ` · ${user.studentId}` : ""}</p>
          <h1>Welcome back, {user.firstName}</h1>
          {children}
        </div>
      </div>
    </section>
  );
}

// Everything below comes from the API for the signed-in user. If there is nothing yet, it says so.
function StudentHome({ user }) {
  const exams = useFetch("/exams");
  const attempts = useFetch("/attempts");
  const list = exams.data?.exams || [];
  const done = attempts.data?.attempts || [];
  const resume = list.find((e) => e.inProgressAttemptId);
  const available = list.filter((e) => e.open && e.attemptsUsed < e.maxAttempts).length;
  const best = done.length ? Math.max(...done.map((a) => a.percentage ?? 0)) : null;

  return (
    <>
      <Banner user={user}>
        <p className="lead-on-dark">Pick up where you left off, or start something new.</p>
        <div className="hero-actions">
          {resume
            ? <Link to={`/exams/${resume.id}`} className="btn btn-gold btn-lg">Resume: {resume.title}</Link>
            : <Link to="/exams" className="btn btn-gold btn-lg">Examination centre <Icon name="arrow" size={18} /></Link>}
          <Link to="/dashboard" className="btn btn-on-dark btn-lg">My dashboard</Link>
        </div>
      </Banner>
      <section className="section home-panels">
        <div className="container">
          <ul className="stat-grid">
            <li className="stat"><span className="stat-num">{exams.loading ? "…" : available}</span><span className="stat-label">Examinations available to you</span></li>
            <li className="stat"><span className="stat-num">{attempts.loading ? "…" : done.length}</span><span className="stat-label">Examinations completed</span></li>
            {best !== null && <li className="stat"><span className="stat-num">{best}%</span><span className="stat-label">Best score so far</span></li>}
          </ul>
          <div className="dash-grid" style={{ marginTop: "var(--s5)" }}>
            <div className="panel">
              <div className="panel-head"><h2 className="panel-title">Recent results</h2><Link to="/results">All results</Link></div>
              {attempts.loading && <p className="muted">Loading...</p>}
              {attempts.error && <p className="alert alert-info" role="status">Your results could not be loaded right now.</p>}
              {attempts.data && done.length === 0 && <p className="note">No results yet. When you submit an examination, it will appear here.</p>}
              {done.slice(0, 3).map((a) => (
                <div key={a.id} className="result-row">
                  <div><strong>{a.examTitle || "Examination"}</strong><br /><span className="muted">{fmtDate(a.submittedAt)}</span></div>
                  <div className="result-score"><strong>{a.percentage}%</strong><Link to={`/results/${a.id}`}>View</Link></div>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2 className="panel-title">Your programmes</h2>
              <p className="note">Programme enrolment will be shown here once the institution records it. See the programmes below.</p>
              <Link to="/dashboard" className="btn btn-secondary btn-sm">Edit my profile</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ParentHome({ user }) {
  return (
    <>
      <Banner user={user}>
        <p className="lead-on-dark">Your parent or guardian account is active.</p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn btn-gold btn-lg">My dashboard</Link>
          <Link to="/faq" className="btn btn-on-dark btn-lg">Read the FAQ</Link>
        </div>
      </Banner>
      <section className="section home-panels">
        <div className="container">
          <div className="panel">
            <h2 className="panel-title">Linked students</h2>
            <p className="note">Linking a student to your account is not available yet. When it is, it will use a secure approval process, and your child's results will appear here. Nothing is shown until a link has been approved.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function AlumniHome({ user }) {
  const status = user.alumniStatus || "unverified";
  return (
    <>
      <Banner user={user}>
        <p className="lead-on-dark">Welcome back to Prime Excelerate Tutelage.</p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn btn-gold btn-lg">My alumni profile</Link>
        </div>
      </Banner>
      <section className="section home-panels">
        <div className="container">
          <div className="panel">
            <h2 className="panel-title">Your alumni status</h2>
            <p className={`badge ${status === "verified" ? "badge-ok" : "badge-quiet"}`}>{ALUMNI_STATUS[status] || status}</p>
            <p className="note">{status === "verified" ? "The institution has confirmed that you studied with Prime Excelerate Tutelage." : "Ask the institution to confirm that you studied with them from your profile page."}</p>
          </div>
        </div>
      </section>
    </>
  );
}

function AdminHomeView({ user }) {
  const exams = useFetch("/admin/exams");
  const programmes = useFetch("/admin/programmes");
  const overview = useFetch("/admin/overview");
  const waiting = overview.data?.pendingStudents ?? 0;
  const e = exams.data?.exams || [];
  const p = programmes.data?.programmes || [];
  const stats = [
    ["Examinations", e.length], ["Published", e.filter((x) => x.status === "published").length],
    ["Submitted attempts", e.reduce((n, x) => n + x.attempts, 0)], ["Programmes published", p.filter((x) => x.status === "published").length],
  ];
  return (
    <>
      <Banner user={user}>
        <p className="lead-on-dark">Manage examinations and programmes for Prime Excelerate Tutelage.</p>
        <div className="hero-actions">
          <Link to="/admin" className="btn btn-gold btn-lg">Open administration</Link>
          <Link to="/admin/exams" className="btn btn-on-dark btn-lg">Examinations</Link>
          <Link to="/admin/programmes" className="btn btn-on-dark btn-lg">Programmes</Link>
        </div>
      </Banner>
      <section className="section home-panels">
        <div className="container">
          {waiting > 0 && (
            <div className="callout" role="status" style={{ marginBottom: "var(--s4)" }}>
              <p><strong>{waiting} student{waiting === 1 ? " is" : "s are"} waiting for your approval.</strong></p>
              <Link to="/admin/students?approval=pending" className="btn btn-primary btn-sm">Review now</Link>
            </div>
          )}
          {(exams.error || programmes.error) && <p className="alert alert-info" role="status">Some figures could not be loaded right now.</p>}
          <ul className="stat-grid">
            {stats.map(([label, value]) => (
              <li key={label} className="stat"><span className="stat-num">{exams.loading || programmes.loading ? "…" : value}</span><span className="stat-label">{label}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

export default function AuthedHome() {
  const { user } = useAuth();
  if (!user) return <p className="page-note" role="status">Loading your account...</p>;
  if (user.role === "admin") return <AdminHomeView user={user} />;
  if (user.role === "parent") return <ParentHome user={user} />;
  if (user.role === "alumni") return <AlumniHome user={user} />;
  if (user.role === "student") return <StudentHome user={user} />;
  return (
    <Banner user={user}>
      <div className="hero-actions"><Link to="/dashboard" className="btn btn-gold btn-lg">My dashboard</Link></div>
    </Banner>
  );
}
