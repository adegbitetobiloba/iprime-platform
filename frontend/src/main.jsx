import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import "./styles.css";
import "./redesign.css";

// Scroll-reveal is progressive enhancement: content is only pre-hidden when the browser supports
// IntersectionObserver AND the user has not asked for reduced motion. Otherwise everything stays visible.
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if ("IntersectionObserver" in window && !reduceMotion) {
  document.documentElement.classList.add("reveal-ready");
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
