// Light/dark theme. Follows the phone's setting until the visitor taps the switch; the choice is then remembered.
// The attribute is set on <html> (data-theme). index.html sets it first, before paint, using the same key and rules.
const KEY = "iprime-theme";
const listeners = new Set();

function readStored() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // storage blocked: the choice then lasts for this visit only
  }
}

let choice = readStored();

function systemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTheme() {
  return choice || systemTheme();
}

export function applyTheme() {
  const t = getTheme();
  document.documentElement.setAttribute("data-theme", t);
  listeners.forEach((fn) => fn(t));
  return t;
}

export function setTheme(t) {
  choice = t === "dark" ? "dark" : "light";
  try { window.localStorage.setItem(KEY, choice); } catch { /* see readStored */ }
  applyTheme();
}

export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  applyTheme();
  const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (mq && mq.addEventListener) mq.addEventListener("change", () => { if (!choice) applyTheme(); });
}
