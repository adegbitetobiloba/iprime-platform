import { Link } from "react-router-dom";
import { eventState, STATE_LABEL } from "../eventsContent.js";

// Dated events (with an automatic Upcoming / Today / Has begun label) or plain announcements.
export default function AnnouncementList({ items, dated = false }) {
  return (
    <ul className="ws5-news">
      {items.map((it) => {
        const state = dated ? eventState(it.date) : null;
        return (
          <li key={it.id} className="ws5-news-item">
            {dated && (
              <div className="ws5-news-date" aria-hidden="true">
                <strong>{it.dateLabel}</strong>
              </div>
            )}
            <div className="ws5-news-body">
              {dated && <span className={`ws5-badge ${state === "started" ? "ws5-badge-soon" : "ws5-badge-now"}`}>{STATE_LABEL[state]}</span>}
              <h3>{it.title}</h3>
              {dated && <p className="ws5-fine">{it.dateLabel} &middot; {it.where}</p>}
              <p>{it.text}</p>
              {it.link && <p><Link to={it.link.to} className="rd-link">{it.link.label}</Link></p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
