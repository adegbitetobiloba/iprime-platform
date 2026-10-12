import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <div className="container">
        <nav className="admin-tabs" aria-label="Administration">
          <NavLink to="/admin" end className="admin-tab">Overview</NavLink>
          <NavLink to="/admin/exams" className="admin-tab">Examinations</NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
