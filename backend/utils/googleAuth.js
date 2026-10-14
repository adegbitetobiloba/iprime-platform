const crypto = require("crypto");

// Verifies a Google Sign-In ID token the way Google documents it: check the RS256 signature against Google's
// published public keys (matched by key id), then check issuer, audience (our own client id), expiry and that
// Google says the email is verified. Only RS256 is accepted, so "alg: none" and algorithm-swap tricks fail.
// No client secret is involved: the client id is public and the token proves who signed in.
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const LEEWAY_SECONDS = 30;

class GoogleAuthError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

let cache = { keys: null, expires: 0 };

async function fetchGoogleKeys(force = false) {
  if (!force && cache.keys && Date.now() < cache.expires) return cache.keys;
  let res;
  try { res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) }); } catch { throw new GoogleAuthError("KEYS_UNAVAILABLE"); }
  if (!res.ok) throw new GoogleAuthError("KEYS_UNAVAILABLE");
  const body = await res.json();
  const maxAge = Number((/max-age=(\d+)/.exec(res.headers.get("cache-control") || "") || [])[1]) || 3600;
  cache = { keys: body.keys || [], expires: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return cache.keys;
}

const b64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
const parseJson = (buf) => { try { return JSON.parse(buf.toString("utf8")); } catch { return null; } };

async function verifyGoogleIdToken(idToken, { clientId, fetchKeys = fetchGoogleKeys, nowMs = Date.now } = {}) {
  if (!clientId) throw new GoogleAuthError("NOT_CONFIGURED");
  if (typeof idToken !== "string" || idToken.length > 4096) throw new GoogleAuthError("INVALID_TOKEN");
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new GoogleAuthError("INVALID_TOKEN");

  const header = parseJson(b64u(parts[0]));
  const payload = parseJson(b64u(parts[1]));
  if (!header || !payload) throw new GoogleAuthError("INVALID_TOKEN");
  if (header.alg !== "RS256" || !header.kid) throw new GoogleAuthError("INVALID_TOKEN", "unsupported algorithm");

  let keys = await fetchKeys(false);
  let jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) { keys = await fetchKeys(true); jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA"); } // keys may have rotated
  if (!jwk) throw new GoogleAuthError("INVALID_TOKEN", "unknown signing key");

  let valid = false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
    valid = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, b64u(parts[2]));
  } catch { valid = false; }
  if (!valid) throw new GoogleAuthError("INVALID_TOKEN", "bad signature");

  const nowSec = Math.floor(nowMs() / 1000);
  if (!ISSUERS.has(payload.iss)) throw new GoogleAuthError("INVALID_TOKEN", "wrong issuer");
  if (payload.aud !== clientId) throw new GoogleAuthError("INVALID_TOKEN", "wrong audience");
  if (typeof payload.exp !== "number" || payload.exp + LEEWAY_SECONDS < nowSec) throw new GoogleAuthError("EXPIRED");
  if (typeof payload.iat === "number" && payload.iat - LEEWAY_SECONDS > nowSec) throw new GoogleAuthError("INVALID_TOKEN", "issued in the future");
  if (!payload.sub || typeof payload.email !== "string") throw new GoogleAuthError("INVALID_TOKEN", "missing claims");
  if (payload.email_verified !== true && payload.email_verified !== "true") throw new GoogleAuthError("EMAIL_NOT_VERIFIED");
  return payload;
}

// Single-use, short-lived nonces issued by OUR server. A Google token is accepted only if it carries a nonce we issued
// and have not seen before, so a captured token cannot be replayed.
function createNonceStore({ ttlMs = 5 * 60 * 1000, max = 5000, nowMs = Date.now } = {}) {
  const map = new Map();
  const sweep = () => { const t = nowMs(); for (const [k, exp] of map) if (exp <= t) map.delete(k); };
  return {
    issue() {
      sweep();
      if (map.size >= max) map.delete(map.keys().next().value);
      const n = crypto.randomBytes(24).toString("hex");
      map.set(n, nowMs() + ttlMs);
      return n;
    },
    consume(n) {
      if (typeof n !== "string") return false;
      const exp = map.get(n);
      map.delete(n);
      return Boolean(exp) && exp > nowMs();
    },
  };
}

module.exports = { verifyGoogleIdToken, createNonceStore, GoogleAuthError };
