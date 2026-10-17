const crypto = require("crypto");

// Short-lived, purpose-bound tokens for multi-step flows (finishing Google sign-up, linking an existing account).
// Signed with HMAC-SHA256 using a key derived from JWT_SECRET, so they cannot be forged or used for a different purpose
// (a "google-link" token is rejected where a "google-setup" token is expected, and neither can act as a login token).
const key = (secret) => crypto.createHmac("sha256", String(secret)).update("iprime-short-token-v1").digest();
const b64u = (buf) => Buffer.from(buf).toString("base64url");

function signShortToken(payload, secret, ttlSeconds, nowMs = Date.now) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(nowMs() / 1000) + ttlSeconds }));
  const sig = crypto.createHmac("sha256", key(secret)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyShortToken(token, secret, purpose, nowMs = Date.now) {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = crypto.createHmac("sha256", key(secret)).update(body).digest();
  let given;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (!payload || payload.purpose !== purpose) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs()) return null;
  return payload;
}

module.exports = { signShortToken, verifyShortToken };
