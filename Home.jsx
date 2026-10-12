import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";

const PLANNED = [
  { icon: "book", title: "Learning library", text: "Study resources organised by subject and topic, for different classes and examinations." },
  { icon: "test", title: "Computer-based practice", text: "Timed practice examinations with clear results, across subjects and classes." },
  { icon: "chart", title: "Progress tracking", text: "Clear results and history for students, with visibility for parents and guardians." },
];

const STEPS = [
  { title: "Create your account", text: "Register as a student, or as a parent or guardian." },
  { title: "Verify your email", text: "Confirm your address with a 6-digit code sent to your inbox." },
  { title: "Open your dashboard", text: "Log in, keep your details up to date, and follow each feature as it is released." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy reveal">
            <p className="pill">Academic excellence for every student</p>
            <h1>Bring out the <span className="accent-text">best</span> in every student.</h1>
            <p className="lead">
              iPrime is the digital platform of Prime Excelerate Tutelage, where students prepare for their examinations, strengthen their studies and keep improving.
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
          <Reveal className="section-head">
            <p className="eyebrow">Coming to iPrime</p>
            <h2>Built around how students prepare</h2>
            <p className="section-lead">These features are in development. Accounts are open now, so you are ready when they launch.</p>
          </Reveal>
          <ul className="feature-grid">
            {PLANNED.map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 100}>
                <div className="feature card-hover">
                  <span className="icon-tile"><Icon name={f.icon} size={22} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <span className="badge">In development</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-split">
        <div className="container split">
          <Reveal className="split-copy">
            <p className="eyebrow">One platform, two views</p>
            <h2>Made for students, and for the parents behind them</h2>
            <p className="section-lead">
              Students get a focused place to study and practise. Parents and guardians get their own account to follow progress as it becomes available.
            </p>
          </Reveal>
          <div className="split-panels">
            <Reveal delay={80}>
              <div className="panel-feature">
                <span className="icon-tile icon-tile-light"><Icon name="user" size={22} /></span>
                <h3>For students</h3>
                <p>Practice, study resources and a record of your results, all in one place.</p>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="panel-plain card-hover">
                <span className="icon-tile"><Icon name="shield" size={22} /></span>
                <h3>For parents and guardians</h3>
                <p>A separate account type, so you can stay informed about your child's preparation.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Getting started</p>
            <h2>Three steps to your account</h2>
          </Reveal>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} className="step" delay={i * 100}>
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="cta-band">
        <Reveal className="container cta-inner">
          <div>
            <h2>Ready to begin?</h2>
            <p>Create your account in a minute and get ready for what is coming.</p>
          </div>
          <Link to="/register" className="btn btn-gold btn-lg">Create an account</Link>
        </Reveal>
      </section>
    </>
  );
}
