import PageHero from "../components/PageHero.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch">
        How to reach Prime Excelerate Tutelage.
      </PageHero>
      <section className="section">
        <div className="container">
          <EmptyState icon="mail" title="Contact details are coming soon">
            The institution's verified telephone number, email address and location will be published here. We do not show unconfirmed contact details.
          </EmptyState>
        </div>
      </section>
    </>
  );
}
