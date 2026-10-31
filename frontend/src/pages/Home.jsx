import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import Photo from "../components/Photo.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import AchievementCard from "../components/AchievementCard.jsx";
import { PaletteArt } from "../components/HeroArt.jsx";
import AuthedHome from "./home/AuthedHome.jsx";
import { IMAGES } from "../siteImages.js";
import { ACCOUNT_TYPES } from "../accountTypes.js";
import { publishableAchievements } from "../achievements.js";

const CBT_POINTS = [
  { icon: "test", title: "Timed, realistic practice", text: "A visible countdown that keeps running even if you refresh the page." },
  { icon: "check", title: "Your answers are saved as you go", text: "Move between questions, mark ones to review, and check what is unanswered before you submit." },
  { icon: "chart", title: "Clear results and history", text: "Your score is calculated by the system and kept so you can see how you are improving." },
];

const WHO = {
  student: { cta: "Sign up as a student", text: "Study, take practice examinations and keep a record of your results." },
  parent: { cta: "Sign up as a parent", text: "Create your account now. Following a child's progress is added once the institution links your accounts." },
  alumni: { cta: "Sign up as alumni", text: "Stay connected with Prime Excelerate Tutelage and ask the institution to confirm that you studied here." },
};

const TRUST = [
  { icon: "shield", text: "Email-verified accounts" },
  { icon: "user", text: "Students, parents and alumni" },
  { icon: "test", text: "Practice examinations set by the institution" },
];

const CYCLE = [
  { title: "Explain", text: "Clear teaching from first principles" },
  { title: "Practise", text: "Regular questions, in class and on iPrime" },
  { title: "Assess", text: "Timed practice shows what has stuck" },
  { title: "Correct", text: "Mistakes reviewed calmly and fixed" },
  { title: "Improve", text: "Retests show real progress" },
];

// Joining is a journey with separate steps. "Apply to enrol" and payment are not live yet, and are labelled that way.
const JOIN = [
  { title: "Create an account", text: "Sign up and verify your email. This is your login.", soon: false },
  { title: "Apply to enrol", text: "Apply for a programme and study mode. The office reviews it.", soon: true },
  { title: "Start learning", text: "Class and paid access open once enrolment is approved and payment confirmed.", soon: true },
];

function PublicHero() {
  const campaign = IMAGES.campaign; // approved campaign flyer, shown unedited; null until management confirms it
  return (
    <section className="ws5-hero">
      <div className="container ws5-hero-grid">
        <div className="ws5-hero-copy reveal">
          <p className="ws5-pill">Prime Excelerate Tutelage</p>
          <h1 className="ws5-h1">Bring out the <span className="ws5-hl">best</span> in every student.</h1>
          <p className="ws5-lead">
            iPrime is the digital platform of Prime Excelerate Tutelage, where students prepare for their examinations, strengthen their studies and keep improving.
          </p>
          <div className="ws5-actions">
            <Link to="/register" className="btn btn-gold btn-lg">Create an account <Icon name="arrow" size={18} /></Link>
            <Link to="/programmes" className="btn btn-on-dark btn-lg">Explore programmes</Link>
          </div>
          <p className="ws5-hero-sub">
            Already have an account? <Link to="/login" className="ws5-hero-link">Student login</Link>
          </p>
          <p className="ws5-hero-note">An account is your login. Enrolling in a programme is a separate application.</p>
        </div>

        <div className="ws5-hero-visual reveal reveal-2">
          {campaign ? (
            <figure className="ws5-flyer">
              <img src={campaign.src} alt={campaign.alt} width={campaign.width} height={campaign.height} fetchPriority="high" decoding="async" />
            </figure>
          ) : (
            <div className="ws5-panel">
              <p className="ws5-panel-title">The Prime learning cycle</p>
              <ol className="ws5-panel-list">
                {CYCLE.map((c, i) => (
                  <li key={c.title}>
                    <span className="ws5-panel-n" aria-hidden="true">{i + 1}</span>
                    <span><strong>{c.title}</strong><small>{c.text}</small></span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { token } = useAuth();
  const achievements = publishableAchievements().slice(0, 3);

  return (
    <>
      {token ? <AuthedHome /> : <PublicHero />}

      {!token && (
        <section className="rd-strip" aria-label="About iPrime accounts">
          <ul className="container rd-strip-list">
            {TRUST.map((t) => (
              <li key={t.text}><span className="rd-strip-icon"><Icon name={t.icon} size={18} /></span>{t.text}</li>
            ))}
          </ul>
        </section>
      )}

      {!token && (
        <section className="section">
          <div className="container split">
            <Reveal className="prose">
              <p className="eyebrow">About us</p>
              <h2>Prepared for every class, subject and examination</h2>
              <p>
                Prime Excelerate Tutelage prepares students, improves their academic performance and brings out the best in every student across different classes, subjects and examinations.
              </p>
              <p><Link to="/about" className="rd-link">More about Prime Excelerate Tutelage <Icon name="arrow" size={16} /></Link></p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="ws5-facts">
                <li><strong>Physical and online</strong><span>Learning at the centre and on iPrime.</span></li>
                <li><strong>Practice you can measure</strong><span>Timed examinations with saved results.</span></li>
                <li><strong>Honest records</strong><span>Results are published only when verified.</span></li>
              </ul>
            </Reveal>
          </div>
        </section>
      )}

      <section className={`section${token ? "" : " section-tint"}`}>
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

      {!token && (
        <section className="section">
          <div className="container">
            <Reveal className="section-head rd-center">
              <p className="eyebrow">How it works</p>
              <h2>Create an account, then apply to enrol</h2>
              <p className="section-lead">Three separate steps, so you always know where you are.</p>
            </Reveal>
            <ol className="ws5-join">
              {JOIN.map((s, i) => (
                <Reveal as="li" key={s.title} className="ws5-join-item" delay={i * 90}>
                  <span className="ws5-journey-num" aria-hidden="true">{i + 1}</span>
                  <h3>{s.title} {s.soon && <span className="ws5-badge ws5-badge-soon">Coming soon</span>}</h3>
                  <p>{s.text}</p>
                </Reveal>
              ))}
            </ol>
            <Reveal><p style={{ marginTop: "var(--s5)" }}><Link to="/how-it-works" className="btn btn-secondary">See every step</Link></p></Reveal>
          </div>
        </section>
      )}

      <section className="section section-split rd-cbt">
        <div className="container split split-media rd-split-rev">
          <Reveal className="split-copy">
            <p className="eyebrow">iPrime and computer-based testing</p>
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
            <p className="ws5-btn-row">
              <Link to={token ? "/exams" : "/register"} className="btn btn-primary">{token ? "Go to the examination centre" : "Create an account"}</Link>
              <Link to="/iprime" className="btn btn-secondary">About iPrime</Link>
            </p>
          </Reveal>
          <Reveal delay={120} className="rd-split-art">
            {IMAGES.cbt
              ? <Photo image={IMAGES.cbt} fallbackIcon="test" fallbackLabel="Computer-based testing" className="media-photo" />
              : <PaletteArt />}
          </Reveal>
        </div>
      </section>

      {/* Shown only when at least one verified, consented achievement exists. Never placeholder or sample content. */}
      {!token && achievements.length > 0 && (
        <section className="section">
          <div className="container">
            <Reveal className="section-head">
              <p className="eyebrow">Achievements</p>
              <h2>Verified student achievements</h2>
            </Reveal>
            <ul className="ws5-ach-grid">
              {achievements.map((a) => (<li key={a.id}><AchievementCard item={a} /></li>))}
            </ul>
            <Reveal><p style={{ marginTop: "var(--s5)" }}><Link to="/achievements" className="btn btn-secondary">All achievements</Link></p></Reveal>
          </div>
        </section>
      )}

      {!token && (
        <>
          <section className="section section-tint">
            <div className="container">
              <Reveal className="section-head rd-center">
                <p className="eyebrow">Who iPrime is for</p>
                <h2>One platform, three ways to belong</h2>
              </Reveal>
              <ul className="who-grid rd-who">
                {ACCOUNT_TYPES.map((t, i) => (
                  <Reveal as="li" key={t.id} delay={i * 90}>
                    <div className={`who-card rd-who-card rd-who-${i % 3} card-hover`}>
                      <span className="icon-tile rd-icon-lg"><Icon name={t.icon} size={24} /></span>
                      <h3>{t.title}</h3>
                      <p>{WHO[t.id].text}</p>
                      <Link to={`/register?type=${t.id}`} className="rd-link">{WHO[t.id].cta} <Icon name="arrow" size={16} /></Link>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>
          <section className="cta-band rd-cta">
            <Reveal className="container cta-inner">
              <div><h2>Ready to begin?</h2><p>Create your account in a minute, with email or with Google. Questions? <Link to="/contact" className="ws5-cta-link">Contact us</Link>.</p></div>
              <Link to="/register" className="btn btn-gold btn-lg">Create an account</Link>
            </Reveal>
          </section>
        </>
      )}
    </>
  );
}
