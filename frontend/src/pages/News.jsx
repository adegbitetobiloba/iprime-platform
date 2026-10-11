import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function News() {
  return (
    <>
      <PageHero eyebrow="News" title="News and announcements">
        Official updates from Prime Excelerate Tutelage.
      </PageHero>
      <section className="section">
        <div className="container">
          <EmptyState
            icon="news"
            title="No announcements yet"
            action={<Link to="/register" className="btn btn-secondary">Create an account</Link>}
          >
            Announcements published by the institution will appear here. Registered students and parents will see updates meant for them in their own dashboards as that feature is released.
          </EmptyState>
        </div>
      </section>
    </>
  );
}
