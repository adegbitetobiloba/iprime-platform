import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import "../../admin.css";

// The sidebar groups the admin area by job. Only pages that exist are listed: no placeholder links.
const NAV = [
  { heading: null, items: [{ to: "/admin", label: "Overview", end: true }] },
  { heading: "Admissions", items: [{ to: "/admin/applications", label: "Applications", badge: true }, { to: "/admin/students", label: "Students and accounts" }] },
  { heading: "Academics", items: [{ to: "/admin/exams", label: "Examinations" }, { to: "/admin/bank", label: "Question bank" }, { to: "/admin/import", label: "Import questions" }, { to: "/admin/analytics", label: "Analytics" }, { to: "/admin/programmes", label: "Programmes" }, { to: "/admin/library", label: "Library" }] },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // Real count of applications waiting for review. If the endpoint is unavailable the badge is simply not shown.
  const summary = useFetch("/admin/enrolments/summary");
  const waiting = summary.data?.counts?.submitted || 0;
  useEffect(() => { setOpen(false); summary.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

  return (
    <div className="adm">
      <button type="button" className="adm-menu-btn" aria-expanded={open} aria-controls="adm-side" onClick={() => setOpen((o) => !o)}>
        <span>Administration menu</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <aside id="adm-side" className={`adm-side${open ? " open" : ""}`}>
        <nav aria-label="Administration">
          <p className="adm-side-title">Administration</p>
          {NAV.map((g, i) => (
            <div key={i} className="adm-group">
              {g.heading && <p className="adm-group-title">{g.heading}</p>}
              <ul className="adm-nav">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <NavLink to={it.to} end={it.end} className={({ isActive }) => `adm-link${isActive ? " active" : ""}`}>
                      <span>{it.label}</span>
                      {it.badge && waiting > 0 && <span className="adm-count" aria-label={`${waiting} waiting`}>{waiting}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="adm-main"><Outlet /></div>
    </div>
  );
}
