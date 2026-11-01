import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import AccountMenu from "./AccountMenu.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { TYPE_LABEL } from "../accountTypes.js";
import MessagesNavLink from "./MessagesNavLink.jsx";

const PUBLIC_LINKS = [
  { to: "/about", label: "About" },
  { to: "/programmes", label: "Programmes" },
  { to: "/events", label: "Events" },
  { to: "/news", label: "News" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const { token, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toggleRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => setOpen(false), [pathname]);

  // While the phone menu is open: lock the page behind it, close on Escape, and move focus into it.
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.querySelector("a, button")?.focus();
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => setOpen(false);
  const canExam = user && (user.role === "student" || user.role === "admin");
  const doLogout = async () => { setLeaving(true); await logout(); setLeaving(false); setOpen(false); navigate("/"); };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="iPrime home">
          <img src="/logo-symbol.webp" alt="" width="48" height="36" />
          <span className="brand-text">
            <span className="brand-prime">PRIME</span>
            <span className="brand-excelerate">EXCELERATE</span>
          </span>
        </Link>

        {/* Wide screens: links across the top and an account dropdown */}
        <nav className="nav" aria-label="Main">
          <ul className="nav-links">
            {PUBLIC_LINKS.map((l) => (<li key={l.to}><NavLink to={l.to} className="nav-link">{l.label}</NavLink></li>))}
            {canExam && <li><NavLink to="/exams" className="nav-link">Exams</NavLink></li>}
            {canExam && <li><NavLink to="/exams" className="nav-link">Exams<li><MessagesNavLink className="nav-link" /></li>

            {user && user.role === "admin" && <li><NavLink to="/admin" className="nav-link">Admin</NavLink></li>}
          </ul>
          <div className="nav-actions">
            {token ? <AccountMenu /> : (
              <>
                <NavLink to="/login" className="nav-link">Log in</NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
              </>
            )}
          </div>
        </nav>

        {/* Light/dark switch: only visible on pages already moved to the new design */}
        <ThemeToggle />

        {/* Phones and tablets: one button that opens a full menu */}
        <button type="button" ref={toggleRef} className="menu-toggle" aria-expanded={open} aria-controls="site-drawer" onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="menu-bars" aria-hidden="true" />
        </button>
      </div>

      <div id="site-drawer" ref={drawerRef} className={`drawer${open ? " drawer-open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu">
        {token && (
          user ? (
            <div className="drawer-account">
              <span className="avatar avatar-lg" aria-hidden="true">{(user.firstName || "?").charAt(0).toUpperCase()}</span>
              <div className="drawer-who">
                <strong>{[user.firstName, user.lastName].filter(Boolean).join(" ")}</strong>
                <span className="muted">{TYPE_LABEL[user.role] || user.role}{user.studentId ? ` · ${user.studentId}` : ""}</span>
              </div>
            </div>
          ) : <div className="drawer-account" aria-busy="true"><span className="avatar avatar-lg avatar-loading" /></div>
        )}

        {token && user && (
          <ul className="drawer-list">
            <li><NavLink to="/dashboard" className="drawer-link" onClick={close}>My dashboard</NavLink></li>
            {canExam && <li><NavLink to="/exams" className="drawer-link" onClick={close}>Examination centre</NavLink></li>}
            {canExam && <li><NavLink to="/results" className="drawer-link" onClick={close}>My results</NavLink></li>}
            {user.role === "admin" && <li><NavLink to="/admin" className="drawer-link" onClick={close}>Administration</NavLink></li>}
          </ul>
        )}

        <p className="drawer-heading">Explore</p>
        <ul className="drawer-list">
          <li><NavLink to="/" end className="drawer-link" onClick={close}>Home</NavLink></li>
          {PUBLIC_LINKS.map((l) => (<li key={l.to}><NavLink to={l.to} className="drawer-link" onClick={close}>{l.label}</NavLink></li>))}
          <li><MessagesNavLink className="drawer-link" onClick={close} /></li>
          <li><NavLink to="/faq" className="drawer-link" onClick={close}>FAQ</NavLink></li>
        </ul>

        <div className="drawer-foot">
          {token ? (
            <button type="button" className="btn btn-danger-outline btn-block btn-lg" onClick={doLogout} disabled={leaving} aria-busy={leaving}>
              {leaving ? "Logging out..." : "Log out"}
            </button>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-block btn-lg" onClick={close}>Sign up</Link>
              <Link to="/login" className="btn btn-secondary btn-block btn-lg" onClick={close}>Log in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
