import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import ProgrammeCards from "../components/ProgrammeCards.jsx";
import { IMAGES } from "../siteImages.js";

export default function Programmes() {
  return (
    <>
      <PageHero eyebrow="Programmes" title="What Prime Excelerate Tutelage offers" image={IMAGES.programmes}>
        Support for students across different classes, subjects and examinations.
      </PageHero>
      <section className="section">
        <div className="container">
          <ProgrammeCards detailed />
          <Reveal>
            <p className="note">
              Creating an iPrime account does not enrol you in a programme. Enrolment details are announced by the institution. <Link to="/contact">Contact the institution</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
