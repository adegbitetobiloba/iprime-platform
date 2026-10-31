// Loads the vendored JSZip on demand (a plain <script>, so no npm dependency and nothing added to the Vite bundle).
let jszipPromise = null;
export function loadJsZip() {
  if (typeof window === "undefined") return Promise.reject(new Error("JSZip can only be loaded in the browser"));
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipPromise) {
    jszipPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/jszip.min.js";
      s.async = true;
      s.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error("JSZip did not load")));
      s.onerror = () => { jszipPromise = null; reject(new Error("The spreadsheet reader could not be loaded. Check your connection and try again.")); };
      document.head.appendChild(s);
    });
  }
  return jszipPromise;
}
