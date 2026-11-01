import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

// "Messages" link with an unread badge. Shows nothing for anyone who is not a student.
export default function MessagesNavLink({ className = "nav-link", onClick }) {
  const { token, user } = useAuth();
  const [n, setN] = useState(0);
  const isStudent = !!token && user && user.role === "student";
  useEffect(() => {
    if (!isStudent) return undefined;
    let live = true;
    const check = () => api("/messages/unread", { token }).then((d) => live && setN(d.unread || 0)).catch(() => {});
    check();
    const t = setInterval(() => { if (!document.hidden) check(); }, 30000);
    return () => { live = false; clearInterval(t); };
  }, [isStudent, token]);
  if (!isStudent) return null;
  return (
    <NavLink to="/messages" className={className} onClick={onClick}>
      Messages{n > 0 && <span className="msg-unread" style={{ marginLeft: 6 }} aria-label={`${n} unread`}>{n}</span>}
    </NavLink>
  );
}
