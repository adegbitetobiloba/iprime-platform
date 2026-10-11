import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";

const ROLE_LABEL = { student: "Student", parent: "Parent or guardian", teacher: "Teacher", admin: "Administrator" };

const UPCOMING = [
  { icon: "book", title: "Learning library", text: "Study resources by subject and topic will appear here." },
  { icon: "test", title: "CBT practice", text: "Practice examinations will be available here when released." },
  { icon: "chart", title: "Results and progress", text: "Your test history and progress will be shown here." },
];

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
}

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return <p className="page-note" role="status">Loading your account...</p>;

  const joined = formatDate(user.createdAt);
  const details = [
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ")],
    ["Email", user.email],
    ["Phone", user.phone],
    ["State", user.state],
    ...(joined ? [["Member since", joined]] : []),
  ];

  return (
    <section className="section dash">
      <div className="container">
        <div className="dash-head reveal">
          <div>
            <p className="pill">{ROLE_LABEL[user.role] || user.role}</p>
            <h1>Welcome, {user.firstName}</h1>
            <p className="muted">Your account is active. Features appear here as they are released.</p>
          </div>
          {user.isVerified && <span className="status-ok"><Icon name="check" size={16} /> Email verified</span>}
        </div>

        <div className="dash-grid">
          <div className="panel reveal reveal-2">
            <h2 className="panel-title">Your account</h2>
            <dl className="details">
              {details.map(([k, v]) => (
                <div key={k} className="details-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel reveal reveal-3">
            <h2 className="panel-title">Coming next</h2>
            <ul className="upcoming">
              {UPCOMING.map((u) => (
                <li key={u.title} className="upcoming-item">
                  <span className="icon-tile icon-tile-sm"><Icon name={u.icon} size={18} /></span>
                  <div>
                    <p className="upcoming-title">{u.title} <span className="badge">In development</span></p>
                    <p className="upcoming-text">{u.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
