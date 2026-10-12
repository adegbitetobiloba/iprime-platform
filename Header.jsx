import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";

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
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]); // close the menu after navigating

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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

        <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span className="menu-bars" aria-hidden="true" />
        </button>

        <nav id="site-nav" className={`nav${open ? " nav-open" : ""}`} aria-label="Main">
          <ul className="nav-links">
            {PUBLIC_LINKS.map((l) => (
              <li key={l.to}><NavLink to={l.to} className="nav-link">{l.label}</NavLink></li>
            ))}
          </ul>
          <div className="nav-actions">
            {token ? (
              <>
                <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
                {user && (user.role === "student" || user.role === "admin") && <NavLink to="/exams" className="nav-link">Exams</NavLink>}
                {user && user.role === "admin" && <NavLink to="/admin" className="nav-link">Admin</NavLink>}
                {user && <span className="avatar" aria-hidden="true">{(user.firstName || "?").charAt(0).toUpperCase()}</span>}
                <button type="button" className="btn btn-quiet btn-sm" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav-link">Log in</NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
