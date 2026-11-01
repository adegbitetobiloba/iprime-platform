// Scrolling helpers that still work on older phones. Browsers without "scroll-behavior" support ignore the options object
// of scrollTo(), so there we set the position directly (instant) instead of doing nothing.
const SMOOTH = typeof document !== "undefined" && "scrollBehavior" in document.documentElement.style;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll a horizontally scrolling box (carousel, chip row) to `left`. */
export function scrollBoxTo(el, left) {
  if (!el) return;
  if (SMOOTH && typeof el.scrollTo === "function") el.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  else el.scrollLeft = left;
}

/** Scroll the whole page back to the top. */
export function scrollPageTop() {
  if (SMOOTH) window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  else window.scrollTo(0, 0);
}
