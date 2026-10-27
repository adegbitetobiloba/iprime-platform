import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import Photo from "../components/Photo.jsx";
import { IMAGES } from "../siteImages.js";

const VALUES = [
  { title: "Academic excellence", text: "A commitment to rigorous preparation and high standards in every subject." },
  { title: "Integrity", text: "Honest work, fair assessment and trustworthy records." },
];

export default function About() {
  return (
    <>
      <PageHero eyebrow="About" title="Prime Excelerate Tutelage">
        An institution dedicated to preparing students, improving their academic performance and helping every student reach their potential.
      </PageHero>

      <section className="section">
        <div className="container split split-media">
          <Reveal className="prose">
            <h2>Our identity</h2>
            <p>
              Prime Excelerate Tutelage works under the tagline <strong>"The Peak of Academic Excellence and Integrity"</strong>.
              Its work is to prepare students and improve their academic performance across different classes, subjects and examinations, and to bring out the best in every student.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <Photo image={IMAGES.about} fallbackIcon="book" fallbackLabel="Teaching at Prime Excelerate Tutelage" className="media-photo" />
          </Reveal>
        </div>
      </section>

      <section className="section section-split">
        <div className="container split split-media rd-split-rev">
          <Reveal className="prose">
            <h2>What iPrime is</h2>
            <p>
              iPrime is the institution's digital platform. It is being built to bring together learning resources, computer-based examinations,
              progress tracking, and a place for students and parents to stay informed. Features are released step by step, and each page says clearly what is available now.
            </p>
            <ul className="value-list">
              {VALUES.map((v) => (
                <li key={v.title} className="value card-hover">
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="rd-split-art">
            <Photo image={IMAGES.learning} fallbackIcon="book" fallbackLabel="Learning resources" className="media-photo" />
          </Reveal>
        </div>
      </section>

      <section className="section">
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
              title="Mission, vision and leadership"
              action={<Link to="/contact" className="btn btn-secondary">How to reach the institution</Link>}
            >
              The institution's mission statement, vision and leadership details will be published here once they are supplied by Prime Excelerate Tutelage.
            </EmptyState>
          </Reveal>
        </div>
      </section>
    </>
  );
}
