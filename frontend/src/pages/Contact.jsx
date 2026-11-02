import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import Icon from "../components/Icon.jsx";
import SwipeCards from "../components/SwipeCards.jsx";
import EnquiryComposer from "../components/EnquiryComposer.jsx";
import { CHANNELS } from "../contactContent.js";

function Channel({ c }) {
  return (
    <div className={`ws5-channel${c.value ? " has-value" : ""}`}>
      <div className="ws5-channel-head">
        <h3>{c.label}</h3>
        <span className={`ws5-badge ${c.status === "official" ? "ws5-badge-now" : "ws5-badge-soon"}`}>{c.status === "official" ? "Official" : "To be confirmed"}</span>
      </div>
      {c.value ? (
        <>
          <p className="ws5-channel-value">{c.value}</p>
          <a className="btn btn-primary btn-sm" href={c.href} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{c.action}</a>
        </>
      ) : c.hours ? (
        <>
          <ul className="ws5-hours">
            {c.hours.map((h) => (<li key={h.who}><span>{h.who}</span><strong>{h.when}</strong></li>))}
          </ul>
          <p className="ws5-channel-note">{c.note}</p>
        </>
      ) : (
        <p className="ws5-channel-note">{c.note}</p>
      )}
    </div>
  );
}

export default function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch">
        Ask about programmes, enrolment, fees or iPrime. The quickest way to reach the institution is WhatsApp or a phone call.
      </PageHero>

      <section className="section">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">Ways to reach us</p>
            <h2>Contact channels</h2>
            <p className="section-lead">These are the institution's official lines and learning hours. Details we are still waiting to confirm say so.</p>
          </Reveal>
          <SwipeCards label="Contact channels" gridFrom="md">
            {CHANNELS.map((c) => (<Channel key={c.id} c={c} />))}
          </SwipeCards>
        </div>
      </section>

      <section className="section section-tint">
        <div className="container split">
          <Reveal><EnquiryComposer /></Reveal>
          <Reveal delay={100} className="prose">
            <h2>Before you write</h2>
            <p>Many questions already have an answer. Try these first:</p>
            <ul className="ws5-links">
              <li><Link to="/faq" className="rd-link">Frequently asked questions <Icon name="arrow" size={16} /></Link></li>
              <li><Link to="/programmes" className="rd-link">Programmes, subjects and the 2027 UTME programme <Icon name="arrow" size={16} /></Link></li>
              <li><Link to="/how-it-works" className="rd-link">How joining and learning works <Icon name="arrow" size={16} /></Link></li>
              <li><Link to="/register" className="rd-link">Create an iPrime account <Icon name="arrow" size={16} /></Link></li>
            </ul>
            <p className="ws5-note">Please do not send card numbers, PINs, one-time passwords or banking passwords in any message. We will never ask for them.</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
