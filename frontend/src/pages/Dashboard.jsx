import { useAuth } from "../auth.jsx";

const ROLE_LABEL = { student: "Student", parent: "Parent or guardian", teacher: "Teacher", admin: "Administrator" };

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return <p className="page-note" role="status">Loading your account...</p>;

  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">{ROLE_LABEL[user.role] || user.role}</p>
        <h1>Welcome, {user.firstName}</h1>
        <p className="muted">Your account is verified and active.</p>
        <div className="card">
          <h2>What happens next</h2>
          <p>The learning library, CBT practice and progress tracking are in development. They will appear here as each one is released.</p>
        </div>
      </div>
    </section>
  );
}
