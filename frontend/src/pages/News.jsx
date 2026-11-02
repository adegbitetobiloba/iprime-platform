import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import AnnouncementList from "../components/AnnouncementList.jsx";
import { ANNOUNCEMENTS } from "../eventsContent.js";

export default function News() {
  return (
    <>
      <PageHero eyebrow="News" title="News and announcements">
        What is happening at Prime Excelerate Tutelage.
      </PageHero>
      <section className="section">
        <div className="container narrow-wide">
          <Reveal><AnnouncementList items={ANNOUNCEMENTS} /></Reveal>
          <Reveal>
            <EmptyState icon="news" title="Follow this page for updates" action={<Link to="/events" className="btn btn-secondary">See key dates</Link>}>
              Announcements about programmes, results and iPrime features appear here as the institution publishes them.
            </EmptyState>
          </Reveal>
        </div>
      </section>
    </>
  );
}
