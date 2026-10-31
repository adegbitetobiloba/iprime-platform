import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <div className="container">
        <nav className="admin-tabs" aria-label="Administration">
          <NavLink to="/admin" end className="admin-tab">Overview</NavLink>
          <NavLink to="/admin/students" className="admin-tab">Students</NavLink>
          <NavLink to="/admin/exams" className="admin-tab">Examinations</NavLink>
          <NavLink to="/admin/bank" className="admin-tab">Question bank</NavLink>
          <NavLink to="/admin/import" className="admin-tab">Import</NavLink>
          <NavLink to="/admin/programmes" className="admin-tab">Programmes</NavLink>
          <NavLink to="/admin/library" className="admin-tab">Library</NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
