import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { CAMPAIGN } from "../campaign.js";

const HIDE = ["/login", "/register", "/verify", "/onboarding", "/pending-approval", "/attempts/", "/admin"];

// Phones only: two always-reachable actions for signed-out visitors, so nobody has to scroll back up to register or ask a question.
export default function MobileActionBar() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  if (token || HIDE.some((p) => pathname.startsWith(p))) return null;
  return (
    <>
      <div className="ws5-bar-spacer" aria-hidden="true" />
      <nav className="ws5-bar" aria-label="Quick actions">
        <Link to="/register" className="btn btn-primary">Create an account</Link>
        <a href={CAMPAIGN.contacts.whatsapp.href} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
      </nav>
    </>
  );
}
