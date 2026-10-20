import { useEffect, useRef } from "react";

// A simple modal for confirmations. Focus moves into it, Escape closes it, and the page behind stays still.
export default function Dialog({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("textarea, input, button")?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose, busy]);
  return (
    <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
