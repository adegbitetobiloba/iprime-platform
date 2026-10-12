import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import Photo from "../components/Photo.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import AuthedHome from "./home/AuthedHome.jsx";
import { IMAGES } from "../siteImages.js";

const CBT_POINTS = [
  { icon: "test", title: "Timed, realistic practice", text: "A visible countdown that keeps running even if you refresh the page." },
  { icon: "check", title: "Your answers are saved as you go", text: "Move between questions, mark ones to review, and see what is still unanswered before you submit." },
  { icon: "chart", title: "Clear results and history", text: "Your score is calculated by the system and kept so you can see how you are improving." },
];

const COMING = [
  { icon: "book", title: "Learning library", text: "Study resources organised by subject and topic, for different classes and examinations." },
  { icon: "chart", title: "Progress insights", text: "Trends across your results as you take more examinations." },
];

const STEPS = [
  { title: "Create your account", text: "Sign up as a student, or as a parent or guardian." },
  { title: "Verify your email", text: "Confirm your address with a 6-digit code sent to your inbox." },
  { title: "Open your dashboard", text: "Log in, keep your details up to date, and use each feature as it is released." },
];

function PublicHero() {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy reveal">
          <p className="pill">Academic excellence for every student</p>
          <h1>Bring out the <span className="accent-text">best</span> in every student.</h1>
          <p className="lead">
            iPrime is the digital platform of Prime Excelerate Tutelage, where students prepare for their examinations, strengthen their studies and keep improving.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Sign up <Icon name="arrow" size={18} /></Link>
            <Link to="/login" className="btn btn-secondary btn-lg">Log in</Link>
          </div>
          <ul className="trust-row">
            <li><Icon name="shield" size={18} /> Email-verified accounts</li>
            <li><Icon name="user" size={18} /> Student and parent access</li>
          </ul>
        </div>
        <div className="hero-visual reveal reveal-2">
          {IMAGES.hero ? (
            <Photo image={IMAGES.hero} priority className="hero-photo" />
          ) : (
            <div className="logo-card">
              <img src="/logo-full.webp" alt="Prime Excelerate logo: a lightbulb above an open book, with the tagline The Peak of Academic Excellence and Integrity" width="360" height="362" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { token } = useAuth();

  return (
    <>
      {token ? <AuthedHome /> : <PublicHero />}

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Programmes</p>
            <h2>Support across classes, subjects and examinations</h2>
            <p className="section-lead">Programmes published by Prime Excelerate Tutelage.</p>
          </Reveal>
          <ProgrammeCards limit={3} />
          <Reveal><p style={{ marginTop: "var(--s5)" }}><Link to="/programmes" className="btn btn-secondary">All programmes</Link></p></Reveal>
        </div>
      </section>

      <section className="section section-split">
        <div className="container split split-media">
          <Reveal className="split-copy">
            <p className="eyebrow">Computer-based testing</p>
            <h2>Practise the way examinations are taken</h2>
            <p className="section-lead">Practice examinations on iPrime are set by the institution and taken on screen, so students get comfortable with the format before it counts.</p>
            <ul className="point-list">
              {CBT_POINTS.map((p) => (
                <li key={p.title}>
                  <span className="icon-tile icon-tile-sm"><Icon name={p.icon} size={18} /></span>
                  <div><strong>{p.title}</strong><p>{p.text}</p></div>
                </li>
              ))}
            </ul>
            <Link to={token ? "/exams" : "/register"} className="btn btn-primary">{token ? "Go to the examination centre" : "Sign up to get started"}</Link>
          </Reveal>
          <Reveal delay={120}>
            <Photo image={IMAGES.cbt} fallbackIcon="test" fallbackLabel="Computer-based testing" className="media-photo" />
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Coming to iPrime</p>
            <h2>More tools for learning</h2>
            <p className="section-lead">These features are in development. They will be released step by step.</p>
          </Reveal>
          <ul className="feature-grid feature-grid-2">
            {COMING.map((f, i) => (
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

      {!token && (
        <>
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
              <div><h2>Ready to begin?</h2><p>Create your account in a minute and get ready for what is coming.</p></div>
              <Link to="/register" className="btn btn-gold btn-lg">Sign up</Link>
            </Reveal>
          </section>
        </>
      )}
    </>
  );
}
