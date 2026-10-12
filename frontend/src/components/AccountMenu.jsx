import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const ROLE_LABEL = { student: "Student", parent: "Parent or guardian", teacher: "Teacher", admin: "Administrator" };

// The signed-in user's menu: who they are, where they can go, and Log out.
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Token present but profile still loading: show a quiet placeholder, never the logged-out buttons.
  if (!user) return <span className="avatar avatar-loading" aria-label="Loading your account" role="status" />;

  const canExam = user.role === "student" || user.role === "admin";
  const doLogout = () => { setOpen(false); logout(); navigate("/"); };

  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{(user.firstName || "?").charAt(0).toUpperCase()}</span>
        <span className="account-name">{user.firstName}</span>
        <span className="account-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{[user.firstName, user.lastName].filter(Boolean).join(" ")}</strong>
            <span className="muted">{ROLE_LABEL[user.role] || user.role}</span>
            {user.studentId && <span className="muted">ID: {user.studentId}</span>}
          </div>
          <Link role="menuitem" to="/dashboard">My dashboard and profile</Link>
          {canExam && <Link role="menuitem" to="/exams">Examination centre</Link>}
          {canExam && <Link role="menuitem" to="/results">My results</Link>}
          {user.role === "admin" && <Link role="menuitem" to="/admin">Administration</Link>}
          <button type="button" role="menuitem" className="account-logout" onClick={doLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
