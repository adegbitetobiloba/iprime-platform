import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import AchievementCard from "../components/AchievementCard.jsx";
import { publishableAchievements } from "../achievements.js";

const CHECKS = [
  "The person's approved public name, spelled as they want it published",
  "The examination, the year and the exact score",
  "The programme and study mode they attended with Prime Excelerate Tutelage",
  "Evidence of the result, such as an official result record",
  "Written permission to publish, with a parent or guardian's permission for anyone under 18",
];

export default function Achievements() {
  const items = publishableAchievements();

  return (
    <>
      <PageHero eyebrow="Achievements" title="Student achievements">
        Results we are proud of, published only when they have been checked and the student has agreed.
      </PageHero>

      <section className="section">
        <div className="container">
          {items.length > 0 ? (
            <ul className="ws5-ach-grid">
              {items.map((a) => (<li key={a.id}><AchievementCard item={a} /></li>))}
            </ul>
          ) : (
            <Reveal>
              <EmptyState
                icon="check"
                title="Verified achievements are being prepared"
                action={<Link to="/programmes" className="btn btn-secondary">See programmes</Link>}
              >
                We only publish a result after it has been verified and the student has given permission. Until then, this page stays empty rather than show figures that have not been checked.
              </EmptyState>
            </Reveal>
          )}
        </div>
      </section>

      <section className="section section-tint">
        <div className="container split">
          <Reveal className="prose">
            <h2>How we verify a result</h2>
            <p>Every achievement shown here is backed by a record that management has checked. Before a result is published we confirm:</p>
            <ul className="ws5-checks">
              {CHECKS.map((c) => (<li key={c}><span className="icon-tile icon-tile-sm" aria-hidden="true">✓</span><span>{c}</span></li>))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="prose">
            <h2>What we do not publish</h2>
            <p>
              We never show candidate or registration numbers, phone numbers or private results, and we do not make claims such as success rates that we cannot prove.
              A student can ask for their name, photograph or story to be removed at any time through <Link to="/contact" className="rd-link">the contact page</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
