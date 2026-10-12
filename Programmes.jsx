import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Programmes() {
  return (
    <>
      <PageHero eyebrow="Programmes" title="What Prime Excelerate Tutelage offers">
        Support for students across different classes, subjects and examinations.
      </PageHero>

      <section className="section">
        <div className="container">
          <Reveal>
            <EmptyState
              icon="book"
              title="Programme details are being finalised"
              action={
                <div className="programme-actions" style={{ justifyContent: "center" }}>
                  <Link to="/register" className="btn btn-primary">Create an account</Link>
                  <Link to="/contact" className="btn btn-secondary">Contact the institution</Link>
                </div>
              }
            >
              The classes, subjects and examination programmes offered by Prime Excelerate Tutelage will be listed here once they are confirmed. We only publish programmes the institution has confirmed.
            </EmptyState>
          </Reveal>
          <Reveal delay={100}>
            <p className="note" style={{ textAlign: "center", marginLeft: "auto", marginRight: "auto" }}>
              Creating an iPrime account does not enrol you in a programme. Enrolment details will be announced by the institution.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
