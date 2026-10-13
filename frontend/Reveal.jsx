import { useEffect, useRef } from "react";

// Fades and lifts its content into place the first time it scrolls into view.
// Without IntersectionObserver (or with reduced motion) the content is simply visible: see main.jsx and styles.css.
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("is-visible"); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal className={className} style={{ "--reveal-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
