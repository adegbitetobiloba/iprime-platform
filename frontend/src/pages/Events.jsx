import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Events() {
  return (
    <>
      <PageHero eyebrow="Events" title="Upcoming events">
        Dates, venues and registration links for institutional events.
      </PageHero>
      <section className="section">
        <div className="container">
          <EmptyState
            icon="calendar"
            title="No events have been announced yet"
            action={<Link to="/register" className="btn btn-secondary">Create an account</Link>}
          >
            When Prime Excelerate Tutelage announces an event, it will appear on this page with its date, time and how to attend.
          </EmptyState>
        </div>
      </section>
    </>
  );
}
