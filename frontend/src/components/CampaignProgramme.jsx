import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CAMPAIGN } from "../campaign.js";
import Countdown from "./Countdown.jsx";
import FlyerFigure from "./FlyerFigure.jsx";
import SwipeCards from "./SwipeCards.jsx";
import Reveal from "./Reveal.jsx";

function SubjectExplorer() {
  const groups = CAMPAIGN.subjectGroups;
  const [active, setActive] = useState(groups[0].id);
  const tabRefs = useRef({});
  const onKeyDown = (e) => {
    const i = groups.findIndex((g) => g.id === active);
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % groups.length;
    if (e.key === "ArrowLeft") n = (i - 1 + groups.length) % groups.length;
    if (n === null) return;
    e.preventDefault();
    setActive(groups[n].id);
    tabRefs.current[groups[n].id]?.focus();
  };
  const group = groups.find((g) => g.id === active);
  return (
    <div className="ws5-subjects">
      <div className="ws5-tabs" role="tablist" aria-label="Subject groups" onKeyDown={onKeyDown}>
        {groups.map((g) => (
          <button key={g.id} type="button" role="tab" id={`ws5-tab-${g.id}`} ref={(el) => { tabRefs.current[g.id] = el; }}
            aria-selected={g.id === active} aria-controls="ws5-subject-panel" tabIndex={g.id === active ? 0 : -1}
            className={`ws5-tab${g.id === active ? " is-on" : ""}`} onClick={() => setActive(g.id)}>{g.label}</button>
        ))}
      </div>
      <ul className="ws5-chips" role="tabpanel" id="ws5-subject-panel" aria-labelledby={`ws5-tab-${active}`}>
        {group.subjects.map((s) => (<li key={s} className="ws5-chip">{s}</li>))}
      </ul>
    </div>
  );
}

// The 2027 UTME campaign, with details taken from the flyer. showFlyer=false when the flyer is already on screen nearby.
export default function CampaignProgramme({ showFlyer = true }) {
  const { title, tagline, mode, startsLabel, registrationFee, feeNote, contacts, reasons, flyer } = CAMPAIGN;
  const withFlyer = showFlyer && Boolean(flyer);
  return (
    <section className="section ws5-campaign">
      <div className={`container ws5-campaign-grid${withFlyer ? " has-flyer" : ""}`}>
        <Reveal className="ws5-campaign-copy">
          <p className="eyebrow">Current programme</p>
          <h2>{title}</h2>
          <p className="section-lead">{tagline}</p>
          <Countdown />
          <dl className="ws5-keyfacts">
            <div><dt>Format</dt><dd>{mode}</dd></div>
            <div><dt>Lectures commence</dt><dd>{startsLabel}</dd></div>
            <div><dt>Registration fee</dt><dd>{registrationFee}</dd></div>
          </dl>
          <p className="ws5-fine">{feeNote}</p>
          <h3 className="ws5-h3">Available subjects</h3>
          <SubjectExplorer />
          <p className="ws5-btn-row">
            <Link to="/register" className="btn btn-primary">Create an account</Link>
            <a href={contacts.whatsapp.href} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">WhatsApp {contacts.whatsapp.display}</a>
            <a href={contacts.call.href} className="btn btn-secondary">Call {contacts.call.display}</a>
          </p>
          <p className="ws5-fine">An iPrime account is your login. To join the programme, contact the institution to enrol.</p>
        </Reveal>
        {withFlyer && <Reveal delay={100} className="ws5-campaign-flyer"><FlyerFigure /></Reveal>}
      </div>
      <div className="container ws5-campaign-reasons">
        <h3 className="ws5-h3">Why choose Prime Excelerate</h3>
        <SwipeCards label="Why choose Prime Excelerate" gridFrom="md">
          {reasons.map((r, i) => (
            <div key={r.title} className="ws5-reason">
              <span className="ws5-cycle-n" aria-hidden="true">{i + 1}</span>
              <h4>{r.title}</h4>
              <p>{r.text}</p>
            </div>
          ))}
        </SwipeCards>
      </div>
    </section>
  );
}
