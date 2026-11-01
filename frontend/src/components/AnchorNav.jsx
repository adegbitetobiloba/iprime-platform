import { useEffect, useRef } from "react";
import { useScrollSpy } from "../useScrollSpy.js";

// "On this page" chips for long pages. Plain anchor links (work without JavaScript, with the keyboard), and the chip for the
// section being read lights up and slides into view as you scroll.
export default function AnchorNav({ items, label = "On this page" }) {
  const active = useScrollSpy(items.map((i) => i.id));
  const listRef = useRef(null);

  useEffect(() => {
    const chip = listRef.current?.querySelector('[aria-current="location"]');
    if (!chip || !listRef.current) return;
    const box = listRef.current;
    const target = chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" }); // scrolls the chip row only, never the page
  }, [active]);

  return (
    <nav className="ws5-anchor" aria-label={label}>
      <ul className="container ws5-anchor-list" ref={listRef}>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className={`ws5-anchor-link${i.id === active ? " is-on" : ""}`} aria-current={i.id === active ? "location" : undefined}>{i.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
