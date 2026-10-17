import { useEffect } from "react";
import { useAuth } from "../auth.jsx";

// Short confirmation or warning (for example after logging out). Polite for screen readers, dismisses itself.
export default function Toast() {
  const { notice, clearNotice } = useAuth();
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(clearNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);
  if (!notice) return null;
  return (
    <div className={`toast toast-${notice.kind}`} role="status" aria-live="polite">
      <span>{notice.text}</span>
      <button type="button" className="toast-close" onClick={clearNotice} aria-label="Dismiss message">×</button>
    </div>
  );
}
