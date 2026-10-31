import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import Photo from "../components/Photo.jsx";
import Icon from "../components/Icon.jsx";
import SwipeCards from "../components/SwipeCards.jsx";
import AnchorNav from "../components/AnchorNav.jsx";
import CampaignProgramme from "../components/CampaignProgramme.jsx";
import { IMAGES } from "../siteImages.js";
import { ABOUT, MISSION_APPROVED } from "../aboutContent.js";

const SECTIONS = [
  { id: "who", label: "Who we are" },
  { id: "purpose", label: "Mission and vision" },
  { id: "values", label: "Values" },
  { id: "teaching", label: "How we teach" },
  { id: "formats", label: "Physical and online" },
  { id: "iprime", label: "iPrime" },
  { id: "programmes", label: "Programmes" },
];

export default function About() {
  return (
    <>
      <PageHero eyebrow="About" title="Prime Excelerate Tutelage">
        An institution dedicated to preparing students, improving their academic performance and helping every student reach their potential.
      </PageHero>

      <AnchorNav items={SECTIONS} />

      <section className="section ws5-anchor-target" id="who">
        <div className="container split split-media">
          <Reveal className="prose">
            <p className="eyebrow">Who we are</p>
            <h2>The Peak of Academic Excellence and Integrity</h2>
            <p>
              Prime Excelerate Tutelage prepares students and improves their academic performance across different classes, subjects and examinations, and works to bring out the best in every student.
            </p>
            <p>{ABOUT.aim}</p>
            <p className="ws5-btn-row">
              <Link to="/programmes" className="btn btn-primary">See programmes</Link>
              <Link to="/contact" className="btn btn-secondary">Contact us</Link>
            </p>
          </Reveal>
          <Reveal delay={100}>
            <Photo image={IMAGES.about} fallbackIcon="book" fallbackLabel="Teaching at Prime Excelerate Tutelage" className="media-photo" />
          </Reveal>
        </div>
      </section>

      <section className="section section-tint ws5-anchor-target" id="purpose">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Why we exist</p>
            <h2>Mission and vision</h2>
            {!MISSION_APPROVED && <p className="ws5-fine">This wording is awaiting confirmation by the institution's management.</p>}
          </Reveal>
          <div className="ws5-purpose">
            <Reveal className="ws5-purpose-card"><span className="icon-tile"><Icon name="check" size={22} /></span><h3>Our mission</h3><p>{ABOUT.mission}</p></Reveal>
            <Reveal delay={100} className="ws5-purpose-card"><span className="icon-tile"><Icon name="eye" size={22} /></span><h3>Our vision</h3><p>{ABOUT.vision}</p></Reveal>
          </div>
        </div>
      </section>

      <section className="section ws5-anchor-target" id="values">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">What we stand for</p>
            <h2>Our values</h2>
          </Reveal>
          <ul className="ws5-chips ws5-values">
            {ABOUT.values.map((v) => (<li key={v} className="ws5-chip">{v}</li>))}
          </ul>
        </div>
      </section>

      <section className="section section-tint ws5-anchor-target" id="teaching">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Our approach</p>
            <h2>How we teach</h2>
            <p className="section-lead">Swipe through the eight habits behind every lesson.</p>
          </Reveal>
          <SwipeCards label="How we teach" gridFrom="md">
            {ABOUT.teaching.map((t, i) => (
              <div key={t.title} className="ws5-reason">
                <span className="ws5-cycle-n" aria-hidden="true">{i + 1}</span>
                <h4>{t.title}</h4>
                <p>{t.text}</p>
              </div>
            ))}
          </SwipeCards>
        </div>
      </section>

      <section className="section ws5-anchor-target" id="formats">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Two ways to learn</p>
            <h2>Physical and online learning</h2>
          </Reveal>
          <div className="ws5-formats">
            {ABOUT.formats.map((f, i) => (
              <Reveal key={f.id} delay={i * 100} className="ws5-format">
                <h3>{f.title}</h3>
                <p className="ws5-format-lead">{f.lead}</p>
                <ul className="ws5-checks">
                  {f.points.map((p) => (<li key={p}><span className="icon-tile icon-tile-sm" aria-hidden="true">✓</span><span>{p}</span></li>))}
                </ul>
              </Reveal>
            ))}
          </div>
          <Reveal><p className="ws5-note">{ABOUT.formatsNote}</p></Reveal>
        </div>
      </section>

      <CampaignProgramme />

      <section className="section section-split ws5-anchor-target" id="iprime">
        <div className="container split split-media rd-split-rev">
          <Reveal className="prose">
            <p className="eyebrow">Our platform</p>
            <h2>What iPrime is</h2>
            <p>
              iPrime is the institution's digital platform. It brings together learning resources, computer-based examinations,
              progress tracking, and a place for students and parents to stay informed. Features are released step by step, and each page says clearly what is available now.
            </p>
            <p className="ws5-btn-row">
              <Link to="/iprime" className="btn btn-primary">Explore iPrime</Link>
              <Link to="/how-it-works" className="btn btn-secondary">How it works</Link>
            </p>
          </Reveal>
          <Reveal delay={100} className="rd-split-art">
            <Photo image={IMAGES.learning} fallbackIcon="book" fallbackLabel="Learning resources" className="media-photo" />
          </Reveal>
        </div>
      </section>

      <section className="section ws5-anchor-target" id="programmes">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">What we offer</p>
            <h2>Our programmes</h2>
            <p className="section-lead">Support across different classes, subjects and examinations.</p>
          </Reveal>
          <ProgrammeCards limit={6} />
          <Reveal><p style={{ marginTop: "var(--s5)" }}><Link to="/programmes" className="btn btn-secondary">See all programme details</Link></p></Reveal>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container">
          <Reveal>
            <EmptyState
              icon="user"
              title="Our story and leadership"
              action={<Link to="/contact" className="btn btn-secondary">How to reach the institution</Link>}
            >
              The institution's history, milestones and leadership profiles will be published here once Prime Excelerate Tutelage confirms them.
            </EmptyState>
          </Reveal>
        </div>
      </section>

      <section className="cta-band rd-cta">
        <Reveal className="container cta-inner">
          <div><h2>Ready to learn the Prime way?</h2><p>Create your account in a minute, or contact us with any question.</p></div>
          <Link to="/register" className="btn btn-gold btn-lg">Create an account</Link>
        </Reveal>
      </section>
    </>
  );
}
