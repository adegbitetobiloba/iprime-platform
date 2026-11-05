// Rules for external share links. Pure functions (no database, no Express).
const crypto = require("crypto");

// 24 random bytes = 192 bits: cannot be guessed. This is the link's only secret, so it is stored as given and the link
// can be revoked at any time.
const newToken = () => crypto.randomBytes(24).toString("base64url");
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;
const looksLikeToken = (t) => TOKEN_SHAPE.test(String(t));

// Optional access code: stored as a salted scrypt hash, compared in constant time.
function hashCode(code) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { codeSalt: salt, codeHash: crypto.scryptSync(String(code), salt, 32).toString("hex") };
}
function verifyCode(code, share) {
  if (!share.codeHash) return true; // no code needed
  if (typeof code !== "string" || !code) return false;
  const a = Buffer.from(crypto.scryptSync(code, share.codeSalt, 32).toString("hex")), b = Buffer.from(share.codeHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The examination password: 4 to 64 characters, compared exactly (case and spaces count). The examiner chooses it.
function cleanPassword(raw) {
  if (typeof raw !== "string") return { ok: false, error: "Enter a password." };
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false, error: "The password cannot contain control characters." };
  if (raw.length < 4) return { ok: false, error: "The password must be at least 4 characters." };
  if (raw.length > 64) return { ok: false, error: "The password can be at most 64 characters." };
  if (!raw.trim()) return { ok: false, error: "The password cannot be only spaces." };
  return { ok: true, value: raw };
}

// A guest MUST give a name. It is shown to the examiner, so it has to look like a name: letters, spaces and the few
// punctuation marks real names use. No markup, no control characters, no numbers-only entries.
function cleanName(raw) {
  const v = String(raw == null ? "" : raw).normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, error: "Please enter your name." };
  if (v.length < 2) return { ok: false, error: "Your name is too short." };
  if (v.length > 60) return { ok: false, error: "Your name is too long (60 characters at most)." };
  if (!/\p{L}/u.test(v)) return { ok: false, error: "Please enter your real name (it must contain letters)." };
  if (/[<>{}\[\]\\\/@=;:"`|^~*%$#!?]/.test(v)) return { ok: false, error: "Your name can only contain letters, spaces, full stops, apostrophes and hyphens." };
  if (/\d/.test(v)) return { ok: false, error: "Your name should not contain numbers." };
  return { ok: true, value: v };
}

// Contact (optional unless the link asks for it): an email address or a phone number.
const EMAIL = /^[^\s@<>()]{1,64}@[^\s@<>()]{1,255}\.[A-Za-z]{2,}$/;
function cleanContact(raw) {
  const v = String(raw == null ? "" : raw).trim();
  if (!v) return { ok: true, value: "", key: "" };
  if (v.length > 120) return { ok: false, error: "That email address or phone number is too long." };
  if (EMAIL.test(v)) return { ok: true, value: v, key: v.toLowerCase() };
  const digits = v.replace(/[\s\-().]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) return { ok: true, value: v, key: digits.replace(/^\+/, "") };
  return { ok: false, error: "Enter a valid email address or phone number." };
}

// Why a link can or cannot be used right now. `exam` may be null (deleted). Existing guests can still resume an attempt
// they already started even when a link is full or expired; this only decides whether NEW people may enter.
function shareState(share, exam, now = new Date()) {
  if (!share) return "invalid";
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && new Date(share.expiresAt) <= now) return "expired";
  if (!exam || exam.status !== "published") return "unavailable";
  if (exam.availableFrom && new Date(exam.availableFrom) > now) return "not_yet";
  if (exam.availableUntil && new Date(exam.availableUntil) < now) return "closed";
  if (share.maxUses && (share.uses || 0) >= share.maxUses) return "full";
  return "open";
}

const STATE_MESSAGE = {
  invalid: "This link is not valid.",
  revoked: "This link has been withdrawn by the examiner.",
  expired: "This link has expired.",
  unavailable: "This examination is not available right now.",
  not_yet: "This examination has not opened yet.",
  closed: "This examination has closed.",
  full: "This link has reached the number of people it allows.",
  open: "",
};

module.exports = { cleanPassword, newToken, looksLikeToken, hashCode, verifyCode, cleanName, cleanContact, shareState, STATE_MESSAGE };
