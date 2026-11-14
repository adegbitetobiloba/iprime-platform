import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth.jsx";
import { api } from "../../api.js";
import { TeacherContext } from "./ui.jsx";
import "../../admin.css";

const NAV = [
  { to: "/teacher/dashboard", label: "Overview" },
  { to: "/teacher/students", label: "My students" },
  { to: "/teacher/library", label: "Library materials" },
  { to: "/teacher/courses", label: "Courses" },
  { to: "/teacher/exams", label: "Tests and mock exams" },
  { to: "/teacher/profile", label: "My profile" },
];

// Why the server said no, in plain words. (Pending and rejected accounts are signed out by api.js with their own notice.)
const BLOCKED = {
  ACCOUNT_SUSPENDED: ["Your account is suspended", "An administrator has suspended your teacher account. Please contact the institution if you have questions."],
  TEACHER_ACCESS_DENIED: ["This area is for approved teachers", "The account you are signed in with is not an approved teacher account."],
};

// The gate for every teacher page. The server decides: /teacher/me only answers for an approved, verified teacher.
// Hiding this page would not protect anything on its own; every teacher API call is checked again on the server.
export default function TeacherLayout() {
  const { token, loading, logout } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = useState({ status: "loading" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let off = false;
    api("/teacher/me", { token })
      .then((d) => { if (!off) setState({ status: "ok", teacher: d.user }); })
      .catch((e) => { if (!off) setState({ status: "blocked", code: e.code, message: e.message }); });
    return () => { off = true; };
  }, [token]);
  useEffect(() => setOpen(false), [pathname]);

  if (loading) return <div className="container" role="status"><p>Loading…</p></div>;
  if (!token) return <Navigate to="/teacher/login" replace state={{ from: pathname }} />;
  if (state.status === "loading") return <div className="container" role="status"><p>Loading…</p></div>;
  if (state.status === "blocked") {
    const [title, text] = BLOCKED[state.code] || ["We could not open the teacher area", state.message || "Please try again."];
    return (
      <div className="tch-blocked">
        <h1>{title}</h1>
        <p>{text}</p>
        <p className="tch-actions" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => logout()}>Sign out</button>
          <Link className="btn btn-secondary" to="/">Back to the site</Link>
        </p>
      </div>
    );
  }

  return (
    <TeacherContext.Provider value={state.teacher}>
      <div className="adm tch">
        <button type="button" className="adm-menu-btn" aria-expanded={open} aria-controls="tch-side" onClick={() => setOpen((o) => !o)}>
          <span>Teacher menu</span><span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <aside id="tch-side" className={`adm-side${open ? " open" : ""}`}>
          <nav aria-label="Teacher area">
            <p className="adm-side-title">Teacher area</p>
            <ul className="adm-nav">
              {NAV.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} className={({ isActive }) => `adm-link${isActive ? " active" : ""}`}><span>{it.label}</span></NavLink>
                </li>
              ))}
            </ul>
            <p className="adm-group-title" style={{ marginTop: "1rem" }}>{state.teacher.firstName} {state.teacher.lastName}</p>
            <ul className="adm-nav">
              <li><Link className="adm-link" to="/"><span>Back to the site</span></Link></li>
              <li><button type="button" className="adm-link" style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => logout()}><span>Sign out</span></button></li>
            </ul>
          </nav>
        </aside>
        <div className="adm-main"><Outlet /></div>
      </div>
    </TeacherContext.Provider>
  );
}
