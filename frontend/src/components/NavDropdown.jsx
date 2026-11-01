import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

// A small, accessible dropdown for the top bar. Opens with click / Enter / Down arrow; Up/Down move between links;
// Escape, a click elsewhere, tabbing out, or choosing a link closes it.
//   items: [{ to, label, end?, extra? }]   extra = true hides the link on wide screens, where it already sits in the top bar.
export default function NavDropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const menuId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const links = () => Array.from(rootRef.current?.querySelectorAll(".ws5-dd-menu a") || []).filter((a) => a.offsetParent !== null);
  const onBlur = (e) => { if (open && rootRef.current && !rootRef.current.contains(e.relatedTarget)) setOpen(false); };
  const onButtonKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); requestAnimationFrame(() => links()[0]?.focus()); }
  };
  const onMenuKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = links();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const n = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[n].focus();
  };

  const current = items.some((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to)));

  return (
    <li className="ws5-dd" ref={rootRef} onBlur={onBlur}>
      <button type="button" ref={btnRef} className={`ws5-dd-btn${current ? " is-current" : ""}`} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} onKeyDown={onButtonKey}>
        {label}<span className="ws5-dd-caret" aria-hidden="true" />
      </button>
      {open && (
        <ul id={menuId} className="ws5-dd-menu" onKeyDown={onMenuKey}>
          {items.map((i) => (<li key={i.to} className={i.extra ? "dd-extra" : undefined}><NavLink to={i.to} end={i.end}>{i.label}</NavLink></li>))}
        </ul>
      )}
    </li>
  );
}
