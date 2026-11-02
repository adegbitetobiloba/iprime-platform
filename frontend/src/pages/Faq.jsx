import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import Reveal from "../components/Reveal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { FAQS, FAQ_CATEGORIES, filterFaqs } from "../faqContent.js";

// Search and topic filters over answers that come only from the institution's brief and from what iPrime does today.
export default function Faq() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterFaqs(FAQS, { category, query }), [category, query]);

  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions">
        Straight answers about Prime Excelerate Tutelage and how iPrime works today.
      </PageHero>
      <section className="section">
        <div className="container narrow-wide">
          <div className="ws5-faq-tools">
            <div className="field">
              <label htmlFor="faq-search">Search the questions</label>
              <input id="faq-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: fees, timer, parent" autoComplete="off" />
            </div>
            <div className="ws5-tabs" role="group" aria-label="Filter by topic">
              <button type="button" className={`ws5-tab${category === "all" ? " is-on" : ""}`} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>
              {FAQ_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={`ws5-tab${category === c.id ? " is-on" : ""}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
              ))}
            </div>
            <p className="ws5-fine" role="status" aria-live="polite">{shown.length} {shown.length === 1 ? "question" : "questions"} shown</p>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon="mail" title="No question matches your search" action={<Link to="/contact" className="btn btn-secondary">Ask us directly</Link>}>
              Try a different word, or choose All topics. If you still cannot find an answer, contact the institution.
            </EmptyState>
          ) : (
            <Reveal>
              <div className="faq-list">
                {shown.map((f) => (
                  <details key={f.id} className="faq-item">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                    {f.link && <p><Link to={f.link.to} className="rd-link">{f.link.label}</Link></p>}
                  </details>
                ))}
              </div>
            </Reveal>
          )}
          <p className="ws5-note">Fees, timetables, intake dates and refund rules are confirmed by the institution. Where an answer says so, please <Link to="/contact">contact us</Link>.</p>
        </div>
      </section>
    </>
  );
}
