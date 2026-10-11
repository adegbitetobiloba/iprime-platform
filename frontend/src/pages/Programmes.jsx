import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import Icon from "../components/Icon.jsx";

export default function Programmes() {
  return (
    <>
      <PageHero eyebrow="Programmes" title="What Prime Excelerate Tutelage offers">
        Programme information is added here as the institution confirms it.
      </PageHero>

      <section className="section">
        <div className="container">
          <Reveal>
            <article className="programme card-hover">
              <span className="icon-tile"><Icon name="book" size={22} /></span>
              <div className="programme-body">
                <h2>JAMB UTME preparation</h2>
                <p>
                  Preparation for the Unified Tertiary Matriculation Examination is the focus of Prime Excelerate Tutelage.
                  The subjects covered, schedule, delivery format and registration details will be published here once confirmed.
                </p>
                <p className="programme-meta"><span className="badge">Details to be announced</span></p>
                <div className="programme-actions">
                  <Link to="/register" className="btn btn-primary">Create an account</Link>
                  <Link to="/contact" className="btn btn-secondary">Contact the institution</Link>
                </div>
              </div>
            </article>
          </Reveal>
          <Reveal delay={100}>
            <p className="note">Creating an iPrime account does not enrol you in a programme. Enrolment details will be announced by the institution.</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
