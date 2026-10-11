import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Header() {
  const { token, logout } = useAuth();
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
        <nav className="nav" aria-label="Main">
          {token ? (
            <>
              <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
              <button type="button" className="btn btn-ghost" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">Log in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
