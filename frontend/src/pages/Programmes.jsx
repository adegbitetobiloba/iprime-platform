import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import CampaignProgramme from "../components/CampaignProgramme.jsx";
import ProgrammeOverview from "../components/ProgrammeOverview.jsx";
import SwipeCards from "../components/SwipeCards.jsx";
import { IMAGES } from "../siteImages.js";
import { OUTCOMES, SUPPORT, SUBJECT_AREAS } from "../programmesContent.js";

export default function Programmes() {
  return (
    <>
      <PageHero eyebrow="Programmes" title="What Prime Excelerate Tutelage offers" image={IMAGES.programmes}>
        Support for students across different classes, subjects and examinations, in person at the centre and online.
      </PageHero>

      <CampaignProgramme />

      <section className="section section-tint">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Programme areas</p>
            <h2>Everything we prepare students for</h2>
            <p className="section-lead">Intake dates, timetables and fees are confirmed by the institution for each programme. Ask about the one you need.</p>
          </Reveal>
          <ProgrammeOverview />
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <Reveal className="prose">
            <p className="eyebrow">What students gain</p>
            <h2>Learning outcomes</h2>
            <ul className="ws5-checks">
              {OUTCOMES.map((o) => (<li key={o}><span className="icon-tile icon-tile-sm" aria-hidden="true">&#10003;</span><span>{o}</span></li>))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="prose">
            <p className="eyebrow">Subjects</p>
            <h2>Subject areas you can ask for</h2>
            <ul className="ws5-chips">
              {SUBJECT_AREAS.map((s) => (<li key={s} className="ws5-chip">{s}</li>))}
            </ul>
            <p className="ws5-fine">Subject combinations follow your course, demand and tutor availability. Ask which are running for your programme.</p>
          </Reveal>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Teaching support</p>
            <h2>How we help students succeed</h2>
          </Reveal>
          <SwipeCards label="Teaching support" gridFrom="md">
            {SUPPORT.map((s, i) => (
              <div key={s.title} className="ws5-reason">
                <span className="ws5-cycle-n" aria-hidden="true">{i + 1}</span>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </div>
            ))}
          </SwipeCards>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Published by the institution</p>
            <h2>Programme listings</h2>
          </Reveal>
          <ProgrammeCards detailed />
          <Reveal>
            <p className="note">
              Creating an iPrime account does not enrol you in a programme. To enrol, <Link to="/contact">contact the institution</Link>; online enrolment is being introduced. See <Link to="/how-it-works">how it works</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
