import { useEffect, useState } from "react";
import { scrollPageTop } from "../scrollCompat.js";

// A small "back to top" button that appears after scrolling down. Uses one passive scroll listener, throttled with requestAnimationFrame.
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setShow(window.scrollY > 700));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, []);

  if (!show) return null;
  return (
    <button type="button" className="ws5-top" onClick={scrollPageTop} aria-label="Back to top">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
    </button>
  );
}
