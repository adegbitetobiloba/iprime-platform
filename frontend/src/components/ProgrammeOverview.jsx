import { Link } from "react-router-dom";
import { PROGRAMME_AREAS } from "../programmesContent.js";
import { CAMPAIGN } from "../campaign.js";
import { programmeEnquiry, whatsappLink } from "../contactContent.js";
import SwipeCards from "./SwipeCards.jsx";

// One card per programme area. Availability is never assumed: everything except the current campaign says "to be confirmed"
// and offers an honest next step (ask the institution on WhatsApp, or use the contact page).
export default function ProgrammeOverview() {
  return (
    <SwipeCards label="Programme areas" gridFrom="md">
      {PROGRAMME_AREAS.map((p) => (
        <article key={p.id} className="ws5-prog">
          <span className={`ws5-badge ws5-prog-badge ${p.status === "current" ? "ws5-badge-now" : "ws5-badge-soon"}`}>
            {p.status === "current" ? "Current programme" : "Availability to be confirmed"}
          </span>
          <h3>{p.title}</h3>
          <p className="ws5-prog-who">{p.who}</p>
          <p>{p.text}</p>
          <ul className="ws5-chips ws5-chips-sm">
            {p.subjects.map((s) => (<li key={s} className="ws5-chip">{s}</li>))}
          </ul>
          {p.more && <p className="ws5-fine">{p.more}</p>}
          {p.hours && <p className="ws5-prog-hours"><strong>Hours:</strong> {p.hours}</p>}
          <p className="ws5-btn-row ws5-prog-cta">
            <a className="btn btn-primary btn-sm" href={whatsappLink(CAMPAIGN.contacts.whatsapp.href, programmeEnquiry(p.title))} target="_blank" rel="noopener noreferrer">
              {p.status === "current" ? "Ask about enrolling" : "Ask about current intake"}
            </a>
            <Link className="btn btn-secondary btn-sm" to="/contact">Contact page</Link>
          </p>
        </article>
      ))}
    </SwipeCards>
  );
}
