import { Link } from "react-router-dom";

const PLANNED = [
  { title: "Learning library", text: "Searchable study resources organised by subject and topic." },
  { title: "CBT practice", text: "Computer-based practice examinations that follow the real UTME format." },
  { title: "Progress tracking", text: "Clear results and history for students, and visibility for parents and guardians." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">JAMB UTME preparation</p>
            <h1>Prepare with discipline. Succeed with integrity.</h1>
            <p className="lead">
              iPrime is the digital platform of Prime Excelerate Tutelage, built for students who are serious about their UTME.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary">Create an account</Link>
              <Link to="/login" className="btn btn-secondary">Log in</Link>
            </div>
          </div>
          <img
            className="hero-logo"
            src="/logo-full.webp"
            alt="Prime Excelerate logo: a lightbulb above an open book, with the tagline The Peak of Academic Excellence and Integrity"
            width="360"
            height="362"
          />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>What iPrime is being built to offer</h2>
          <p className="section-lead">These features are in development. Accounts are open now so you are ready when they launch.</p>
          <ul className="feature-list">
            {PLANNED.map((f) => (
              <li key={f.title} className="feature">
                <span className="badge">In development</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
