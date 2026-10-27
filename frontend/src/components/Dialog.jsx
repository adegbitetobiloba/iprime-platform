import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible modal (WAI-ARIA dialog pattern).
//  - role="dialog" (or "alertdialog" for a confirmation that needs an answer) with aria-modal="true",
//    labelled by its title and, if given, described by `description`.
//  - Rendered in a portal on <body>, and the app root is made inert while it is open, so keyboard and
//    screen-reader users cannot reach the page behind it (this is what aria-modal promises).
//  - Focus moves in, Tab and Shift+Tab stay inside, Escape closes (unless `busy`), and focus returns to the
//    control that opened it. The effect runs once, so typing in the dialog never moves focus.
export default function Dialog({ title, description, children, onClose, busy = false, role = "dialog" }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { onCloseRef.current = onClose; busyRef.current = busy; });

  useEffect(() => {
    const opener = document.activeElement;
    const appRoot = document.getElementById("root");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (appRoot) { appRoot.setAttribute("inert", ""); appRoot.setAttribute("aria-hidden", "true"); }

    const box = ref.current;
    const items = () => Array.from(box.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    (box.querySelector("[data-autofocus]") || items()[0] || box).focus();

    const onKey = (e) => {
      if (e.key === "Escape") { if (!busyRef.current) { e.preventDefault(); onCloseRef.current?.(); } return; }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); box.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (appRoot) { appRoot.removeAttribute("inert"); appRoot.removeAttribute("aria-hidden"); }
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    };
  }, []);

  return createPortal(
    <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
      <div className="dialog" role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descId} className="muted">{description}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}
