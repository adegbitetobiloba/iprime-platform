import { useEffect, useRef } from "react";

// Fades and lifts its content into place as it approaches the screen, on phones and laptops alike.
// It is quick (about a third of a second) and starts just BEFORE the content scrolls into view, so fast scrolling never shows blank gaps.
// Without IntersectionObserver, or with reduced motion, content is simply visible: see main.jsx and ws5.css.
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) { el.classList.add("is-visible"); return undefined; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
        });
      },
      { threshold: 0, rootMargin: "0px 0px 18% 0px" } // 18% early: it is already fading in as it reaches the screen edge
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // data-rv (not data-reveal) so the older, slower reveal styles no longer apply; timing now lives in ws5.css.
  return (
    <Tag ref={ref} data-rv className={className} style={{ "--reveal-delay": `${Math.min(delay, 120)}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
