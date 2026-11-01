import { useEffect, useState } from "react";

/** Pure helper: the first id (in page order) that is currently on screen, else the previous choice. */
export function pickActive(ids, visible, previous) {
  const first = ids.find((id) => (visible[id] || 0) > 0);
  return first || previous || ids[0];
}

/** Returns the id of the page section the reader is currently looking at (IntersectionObserver, no scroll listener). */
export function useScrollSpy(ids, offset = 96) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || !("IntersectionObserver" in window)) return undefined;
    const visible = {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { visible[e.target.id] = e.isIntersecting ? e.intersectionRatio || 0.01 : 0; });
        setActive((prev) => pickActive(ids, visible, prev));
      },
      { rootMargin: `-${offset}px 0px -55% 0px`, threshold: [0, 0.1, 0.5, 1] }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, offset]);

  return active;
}
