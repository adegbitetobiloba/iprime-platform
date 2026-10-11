import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

const PLANNED = [
  { icon: "book", title: "Learning library", text: "Searchable study resources organised by subject and topic." },
  { icon: "test", title: "CBT practice", text: "Computer-based practice examinations that follow the real UTME format." },
  { icon: "chart", title: "Progress tracking", text: "Clear results and history for students, with visibility for parents and guardians." },
];

const STEPS = [
  { title: "Create your account", text: "Register as a student, or as a parent or guardian." },
  { title: "Verify your email", text: "Confirm your address with a 6-digit code sent to your inbox." },
  { title: "Open your dashboard", text: "Log in and follow each feature as it is released." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy reveal">
            <p className="pill">JAMB UTME preparation</p>
            <h1>Prepare with discipline. Succeed with integrity.</h1>
            <p className="lead">
              iPrime is the digital platform of Prime Excelerate Tutelage, built for students who are serious about their UTME.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">Create an account <Icon name="arrow" size={18} /></Link>
              <Link to="/login" className="btn btn-secondary btn-lg">Log in</Link>
            </div>
            <ul className="trust-row">
              <li><Icon name="shield" size={18} /> Email-verified accounts</li>
              <li><Icon name="user" size={18} /> Student and parent access</li>
            </ul>
          </div>
          <div className="hero-visual reveal reveal-2">
            <div className="logo-card">
              <img
                src="/logo-full.webp"
                alt="Prime Excelerate logo: a lightbulb above an open book, with the tagline The Peak of Academic Excellence and Integrity"
                width="360" height="362"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Coming to iPrime</p>
            <h2>Built around how students prepare</h2>
            <p className="section-lead">These features are in development. Accounts are open now, so you are ready when they launch.</p>
          </div>
          <ul className="feature-grid">
            {PLANNED.map((f) => (
              <li key={f.title} className="feature card-hover">
                <span className="icon-tile"><Icon name={f.icon} size={22} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <span className="badge">In development</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Getting started</p>
            <h2>Three steps to your account</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-inner">
          <div>
            <h2>Ready to begin?</h2>
            <p>Create your account in a minute and get ready for what is coming.</p>
          </div>
          <Link to="/register" className="btn btn-gold btn-lg">Create an account</Link>
        </div>
      </section>
    </>
  );
}
