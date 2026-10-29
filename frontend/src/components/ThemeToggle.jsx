import { useEffect, useState } from "react";
import { getTheme, setTheme, subscribeTheme } from "../theme.js";

// Light/dark switch. The label stays "Dark theme" and aria-pressed carries the state. Hidden by CSS on pages that
// have not been moved to the new design yet (it only shows when <html> has data-v2).
export default function ThemeToggle() {
  const [theme, setCurrent] = useState(getTheme);
  useEffect(() => subscribeTheme(setCurrent), []);
  const dark = theme === "dark";
  return (
    <button type="button" className="theme-toggle" aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
      <span className="sr-only">Dark theme</span>
      <svg className="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
      </svg>
      <svg className="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
