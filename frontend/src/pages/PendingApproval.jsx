import { Link, useLocation } from "react-router-dom";
import Icon from "../components/Icon.jsx";

const STEPS = [
  { label: "Account created", done: true },
  { label: "Email address verified", done: true },
  { label: "An administrator reviews your registration", current: true },
  { label: "You receive an email, then you can log in" },
];

// Where a new student lands after registering (or trying to log in) until an administrator approves them.
export default function PendingApproval() {
  const { state } = useLocation();
  const email = state?.email;
  return (
    <section className="section pending-page">
      <div className="container narrow-wide">
        <div className="pending-card reveal">
          <span className="icon-tile icon-tile-lg"><Icon name="clock" size={28} /></span>
          <p className="eyebrow">{state?.justRegistered ? "Registration received" : "Account status"}</p>
          <h1>{state?.justRegistered ? "Thank you! Your registration is waiting for approval." : "Your account is waiting for approval."}</h1>
          <p className="lead">
            New students are approved by an administrator of Prime Excelerate Tutelage before they can log in.
            {email ? <> We will email <strong>{email}</strong> as soon as it is done.</> : " We will email you as soon as it is done."}
          </p>

          <ol className="timeline" aria-label="Progress">
            {STEPS.map((s) => (
              <li key={s.label} className={s.done ? "is-done" : s.current ? "is-current" : ""} aria-current={s.current ? "step" : undefined}>
                <span className="timeline-dot" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : null}</span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>

          <p className="note">There is nothing more you need to do. Please check your spam folder if you do not see our email. If it takes longer than you expect, <Link to="/contact">contact the institution</Link>.</p>
          <div className="form-actions">
            <Link to="/login" className="btn btn-primary btn-lg">I have been approved: log in</Link>
            <Link to="/" className="btn btn-secondary btn-lg">Back to home</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
