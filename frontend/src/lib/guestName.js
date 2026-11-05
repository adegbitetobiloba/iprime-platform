// Mirrors the server's rule for a guest's name (backend/utils/shareAccess.js cleanName). The server is the authority; this
// only saves a round trip and gives instant feedback.
export function checkName(raw) {
  const v = String(raw == null ? "" : raw).normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, error: "Please enter your name." };
  if (v.length < 2) return { ok: false, error: "Your name is too short." };
  if (v.length > 60) return { ok: false, error: "Your name is too long (60 characters at most)." };
  if (!/\p{L}/u.test(v)) return { ok: false, error: "Please enter your real name (it must contain letters)." };
  if (/[<>{}[\]\\/@=;:"`|^~*%$#!?]/.test(v)) return { ok: false, error: "Your name can only contain letters, spaces, full stops, apostrophes and hyphens." };
  if (/\d/.test(v)) return { ok: false, error: "Your name should not contain numbers." };
  return { ok: true, value: v };
}
export const checkPassword = (p) => (typeof p !== "string" || p.length < 4 ? { ok: false, error: "The password must be at least 4 characters." } : p.length > 64 ? { ok: false, error: "The password can be at most 64 characters." } : !p.trim() ? { ok: false, error: "The password cannot be only spaces." } : { ok: true });
