import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import MobileActionBar from "./MobileActionBar.jsx";
import BackToTop from "./BackToTop.jsx";

export default function Footer() {
  const { token } = useAuth();
  return (
    <>
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
          <Link to="/how-it-works">How it works</Link>
          <Link to="/achievements">Achievements</Link>
          <Link to="/iprime">iPrime</Link>
          <Link to="/events">Events</Link>
          <Link to="/news">News</Link>
        </nav>
        <nav className="footer-col" aria-label="Help and account">
          <h2 className="footer-heading">{token ? "Your account" : "Help and account"}</h2>
          <Link to="/faq">FAQ</Link>
          <Link to="/contact">Contact</Link>
          {token ? <Link to="/dashboard">Dashboard</Link> : (<><Link to="/login">Log in</Link><Link to="/register">Create an account</Link></>)}
        </nav>
      </div>
    </footer>
    <MobileActionBar />
    <BackToTop />
    </>
  );
}
