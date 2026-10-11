import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <p className="footer-tagline">The Peak of Academic Excellence and Integrity</p>
          <p className="footer-small">iPrime is the digital platform of Prime Excelerate Tutelage.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </nav>
      </div>
    </footer>
  );
}
