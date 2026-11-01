import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import "../../admin.css";
import "../../messages.css";

// The sidebar groups the admin area by job. Only pages that exist are listed: no placeholder links.
const NAV = [
  { heading: null, items: [{ to: "/admin", label: "Overview", end: true }] },
  { heading: "Admissions", items: [{ to: "/admin/applications", label: "Applications", badge: "applications" }, { to: "/admin/students", label: "Students and accounts" }] },
  { heading: "Academics", items: [{ to: "/admin/exams", label: "Examinations" }, { to: "/admin/bank", label: "Question bank" }, { to: "/admin/import", label: "Import questions" }, { to: "/admin/analytics", label: "Analytics" }, { to: "/admin/programmes", label: "Programmes" }, { to: "/admin/library", label: "Library" }] },
  { heading: "Communication", items: [{ to: "/admin/messages", label: "Messages", badge: "messages" }] },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // Real counts of what is waiting. If an endpoint is unavailable the badge is simply not shown.
  const apps = useFetch("/admin/enrolments/summary");
  const msgs = useFetch("/admin/messages/summary");
  const counts = { applications: apps.data?.counts?.submitted || 0, messages: msgs.data?.unreadConversations || 0 };
  useEffect(() => { setOpen(false); apps.reload(); msgs.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pathname]);

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
                {g.items.map((it) => {
                  const n = it.badge ? counts[it.badge] : 0;
                  return (
                    <li key={it.to}>
                      <NavLink to={it.to} end={it.end} className={({ isActive }) => `adm-link${isActive ? " active" : ""}`}>
                        <span>{it.label}</span>
                        {n > 0 && <span className="adm-count" aria-label={`${n} waiting`}>{n}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="adm-main"><Outlet /></div>
    </div>
  );
}
