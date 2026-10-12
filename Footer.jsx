import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <p className="footer-name">Prime Excelerate Tutelage</p>
          <p className="footer-tagline">The Peak of Academic Excellence and Integrity</p>
          <p className="footer-small">iPrime is the digital platform of Prime Excelerate Tutelage.</p>
        </div>
        <nav className="footer-col" aria-label="Explore">
          <h2 className="footer-heading">Explore</h2>
          <Link to="/about">About</Link>
          <Link to="/programmes">Programmes</Link>
          <Link to="/events">Events</Link>
          <Link to="/news">News</Link>
        </nav>
        <nav className="footer-col" aria-label="Help and account">
          <h2 className="footer-heading">Help and account</h2>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </nav>
      </div>
    </footer>
  );
}
