// Locked exam browser (Safe Exam Browser) verification. Pure functions, no database.
//
// How it works (Safe Exam Browser's documented "Browser Exam Key" / "Config Key" mechanism): on every request SEB adds
//   X-SafeExamBrowser-RequestHash   = SHA-256( full request URL + BrowserExamKey )
//   X-SafeExamBrowser-ConfigKeyHash = SHA-256( full request URL + ConfigKey )
// The server knows the keys the examiner approved, rebuilds the same hash for THIS request's URL, and compares.
//
// What it can and cannot do: it proves the request came from an SEB build and configuration that holds an approved key.
// It cannot prove the person is honest. The Config Key can be worked out by anyone who can read an unencrypted
// configuration file, so protect the configuration with a password and prefer the Browser Exam Key.
const crypto = require("crypto");

const HEX64 = /^[0-9a-f]{64}$/;
const MAX_KEYS = 10;

// Keeps only well-formed keys, lower-cased and de-duplicated.
const normaliseKeys = (list) => [...new Set((Array.isArray(list) ? list : []).map((k) => String(k).trim().toLowerCase()).filter((k) => HEX64.test(k)))].slice(0, MAX_KEYS);
const looksLikeKey = (k) => HEX64.test(String(k).trim().toLowerCase());

// The URL exactly as the browser requested it. SEB_URL_BASE (for example https://api.example.com) overrides the host,
// for the rare case where a proxy changes it.
function requestUrl(req) {
  const base = process.env.SEB_URL_BASE ? process.env.SEB_URL_BASE.replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
  return `${base}${req.originalUrl}`;
}

const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const expectedHash = (url, key) => sha256(url + String(key).toLowerCase());
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const header = (req, name) => { const v = req.headers[name]; return String(Array.isArray(v) ? v[0] : v || "").trim().toLowerCase(); };

// -> { sebDetected, ok, via }   ok is true only when a header matches an approved key.
function check(req, lockedBrowser) {
  const lb = lockedBrowser || {};
  const requestHash = header(req, "x-safeexambrowser-requesthash");
  const configHash = header(req, "x-safeexambrowser-configkeyhash");
  const sebDetected = Boolean(requestHash || configHash || /\bSEB\b/.test(String(req.headers["user-agent"] || "")));
  const url = requestUrl(req);
  if (requestHash && normaliseKeys(lb.browserExamKeys).some((k) => same(expectedHash(url, k), requestHash))) return { sebDetected, ok: true, via: "browserExamKey" };
  if (configHash && normaliseKeys(lb.configKeys).some((k) => same(expectedHash(url, k), configHash))) return { sebDetected, ok: true, via: "configKey" };
  return { sebDetected, ok: false, via: null };
}

const LOCKED_MESSAGE = "This examination must be taken in Safe Exam Browser. Open the link your examiner gave you in Safe Exam Browser (using the configuration file they provided), then try again.";

module.exports = { normaliseKeys, looksLikeKey, requestUrl, expectedHash, check, LOCKED_MESSAGE, MAX_KEYS };
