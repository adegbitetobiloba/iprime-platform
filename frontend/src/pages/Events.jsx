import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import AnnouncementList from "../components/AnnouncementList.jsx";
import { EVENTS, sortEvents } from "../eventsContent.js";

export default function Events() {
  return (
    <>
      <PageHero eyebrow="Events" title="Events and key dates">
        Programme start dates, orientation, mock and revision sessions announced by Prime Excelerate Tutelage.
      </PageHero>
      <section className="section">
        <div className="container narrow-wide">
          <Reveal><AnnouncementList items={sortEvents(EVENTS)} dated /></Reveal>
          <Reveal>
            <EmptyState icon="calendar" title="More dates will be added here" action={<Link to="/contact" className="btn btn-secondary">Ask about upcoming dates</Link>}>
              Orientation, mock examinations and revision sessions are listed once the institution confirms their dates. A date that has passed is marked automatically.
            </EmptyState>
          </Reveal>
        </div>
      </section>
    </>
  );
}
