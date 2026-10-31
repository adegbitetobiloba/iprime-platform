import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { IMAGES } from "../siteImages.js";

const KEY = "ws5.welcome.seen";

// Start page: the approved campaign flyer fills the screen for a first-time visitor to the home page, once per browser session.
// It is only shown when IMAGES.welcome is set, never to signed-in users, and can always be skipped.
export default function WelcomeFlyer() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const flyer = IMAGES.welcome;
  const skipRef = useRef(null);
  const [open, setOpen] = useState(() => {
    if (!flyer || typeof window === "undefined" || window.location.pathname !== "/") return false;
    try { return !window.sessionStorage.getItem(KEY); } catch { return true; }
  });

  const show = open && flyer && !token && pathname === "/";

  const close = () => {
    setOpen(false);
    try { window.sessionStorage.setItem(KEY, "1"); } catch { /* storage unavailable: the page simply shows again next visit */ }
  };

  useEffect(() => {
    if (!show) return undefined;
    document.body.style.overflow = "hidden";
    skipRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [show]);

  if (!show) return null;
  return (
    <div className="ws5-welcome" role="dialog" aria-modal="true" aria-label="Welcome to Prime Excelerate Tutelage">
      <div className="ws5-welcome-top">
        <span className="ws5-welcome-brand">Prime Excelerate Tutelage</span>
        <button type="button" ref={skipRef} className="ws5-welcome-skip" onClick={close}>Continue to website</button>
      </div>
      <div className="ws5-welcome-stage">
        <img src={flyer.src} alt={flyer.alt} width={flyer.width} height={flyer.height} fetchPriority="high" decoding="async" />
      </div>
      <div className="ws5-welcome-actions">
        <Link to="/register" className="btn btn-gold btn-lg" onClick={close}>Create an account</Link>
        <button type="button" className="btn btn-on-dark btn-lg" onClick={close}>Explore the website</button>
      </div>
    </div>
  );
}
