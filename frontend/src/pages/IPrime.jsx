import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import Icon from "../components/Icon.jsx";
import SwipeCards from "../components/SwipeCards.jsx";

const NOW = [
  { icon: "test", title: "Timed practice examinations", text: "Practice examinations set by the institution, taken on screen with a countdown that keeps running even if you refresh the page." },
  { icon: "check", title: "Answers saved as you go", text: "Move between questions, mark ones to review and check what is unanswered before you submit." },
  { icon: "chart", title: "Results and history", text: "Your score is calculated by the system and kept, so you can look back at earlier attempts." },
  { icon: "user", title: "Accounts for students, parents and alumni", text: "Sign up with email or Google. Each account sees only its own information." },
];

const SOON = [
  { icon: "user", title: "Student enrolment and payment status", text: "Apply to join a programme and follow your application, fee and access in one place." },
  { icon: "book", title: "Learning library", text: "Study materials organised by subject and topic, linked to practice." },
  { icon: "chart", title: "Progress by topic", text: "See which topics are strong and which need more work." },
];

const FAIR = [
  "The server controls the deadline, so changing the clock on a device does not add time.",
  "Correct answers and explanations are not sent to students while an attempt is in progress.",
  "Your answers are saved during the attempt, and a failed save is reported rather than hidden.",
];

function Card({ item, soon }) {
  return (
    <div className="ws5-feature">
      <span className="icon-tile"><Icon name={item.icon} size={22} /></span>
      <div>
        <h3>{item.title} {soon && <span className="ws5-badge ws5-badge-soon">Coming soon</span>}</h3>
        <p>{item.text}</p>
      </div>
    </div>
  );
}

export default function IPrime() {
  const { token } = useAuth();
  return (
    <>
      <PageHero eyebrow="iPrime" title="The digital platform of Prime Excelerate Tutelage">
        iPrime extends learning beyond the classroom. It is not a separate institution: it is how Prime Excelerate Tutelage practises, assesses and keeps records online.
      </PageHero>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Available now</p>
            <h2>What you can do on iPrime today</h2>
          </Reveal>
          <SwipeCards label="Available now" gridFrom="md">
            {NOW.map((f) => (<Card key={f.title} item={f} />))}
          </SwipeCards>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Being introduced</p>
            <h2>Coming next</h2>
            <p className="section-lead">Features are released step by step. These are not available yet.</p>
          </Reveal>
          <SwipeCards label="Coming next" gridFrom="md">
            {SOON.map((f) => (<Card key={f.title} item={f} soon />))}
          </SwipeCards>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <Reveal className="prose">
            <h2>Built to be fair</h2>
            <ul className="ws5-checks">
              {FAIR.map((t) => (<li key={t}><span className="icon-tile icon-tile-sm" aria-hidden="true">✓</span><span>{t}</span></li>))}
            </ul>
            <p>A browser cannot see everything a student does, so iPrime does not claim to detect every form of malpractice. Fair practice still depends on honest work.</p>
          </Reveal>
          <Reveal delay={100} className="prose">
            <h2>Get started</h2>
            <p>{token ? "You are signed in. Open the examination centre to see the practice examinations available to you." : "Create an account to begin. It takes a minute, with email or with Google."}</p>
            <p>
              <Link to={token ? "/exams" : "/register"} className="btn btn-primary btn-lg">{token ? "Go to the examination centre" : "Create an account"}</Link>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
