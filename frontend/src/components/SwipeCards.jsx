import { Children, useCallback, useEffect, useRef, useState } from "react";

// Swipe-through cards for phones, with no dependencies. Uses native scroll-snapping, so touch, trackpad and keyboard
// all work. On wide screens (gridFrom="md") the same cards simply lay out as a grid and the controls disappear.
//   single   : one card fills the width (step-by-step pager)
//   gridFrom : "md" = grid from 900px up
export default function SwipeCards({ label, children, single = false, gridFrom, className = "" }) {
  const trackRef = useRef(null);
  const raf = useRef(0);
  const items = Children.toArray(children);
  const count = items.length;
  const [index, setIndex] = useState(0);

  const stepOf = (el) => {
    const k = el.children;
    return k.length > 1 ? k[1].offsetLeft - k[0].offsetLeft : el.clientWidth || 1;
  };

  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      if (!el) return;
      const i = Math.round(el.scrollLeft / stepOf(el));
      setIndex(Math.max(0, Math.min(count - 1, i)));
    });
  }, [count]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const n = Math.max(0, Math.min(count - 1, i));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: n * stepOf(el), behavior: reduce ? "auto" : "smooth" });
    setIndex(n);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
  };

  if (count === 0) return null;

  return (
    <div className={`ws5-swipe${single ? " is-single" : ""}${gridFrom === "md" ? " is-grid-md" : ""} ${className}`.trim()}
      role="group" aria-roledescription="carousel" aria-label={label}>
      <div className="ws5-swipe-track" ref={trackRef} onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0}>
        {items.map((child, i) => (
          <div className="ws5-swipe-item" key={child.key ?? i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="ws5-swipe-ui">
          <button type="button" className="ws5-swipe-btn" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <div className="ws5-swipe-dots">
            <span className="ws5-swipe-count" aria-live="polite">{index + 1} of {count}</span>
            <span className="ws5-swipe-pips">
              {items.map((_, i) => (
                <button type="button" key={i} className={`ws5-swipe-pip${i === index ? " is-on" : ""}`} onClick={() => goTo(i)} aria-label={`Go to card ${i + 1}`} aria-current={i === index ? "true" : undefined} />
              ))}
            </span>
          </div>
          <button type="button" className="ws5-swipe-btn" onClick={() => goTo(index + 1)} disabled={index === count - 1} aria-label="Next card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
