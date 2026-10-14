const jwt = require("jsonwebtoken");
const User = require("../models/User");
const publicUser = require("../utils/publicUser");
const { ensureStudentId } = require("../utils/studentId");
const { applyAdminAllowlist } = require("../utils/adminAllowlist");
const { verifyGoogleIdToken, createNonceStore } = require("../utils/googleAuth");

const nonces = createNonceStore();
const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

// Turns a verification failure into a safe, plain response. Token details are never echoed back or logged.
function sendGoogleError(res, err) {
  switch (err.code) {
    case "NOT_CONFIGURED": return res.status(503).json({ error: "Google sign-in is not set up yet.", code: "GOOGLE_NOT_CONFIGURED" });
    case "KEYS_UNAVAILABLE": return res.status(502).json({ error: "Could not reach Google to confirm your sign-in. Please try again.", code: "GOOGLE_UNREACHABLE" });
    case "EMAIL_NOT_VERIFIED": return res.status(401).json({ error: "Your Google email address is not verified.", code: "GOOGLE_EMAIL_UNVERIFIED" });
    case "EXPIRED": return res.status(401).json({ error: "That Google sign-in expired. Please try again.", code: "GOOGLE_EXPIRED" });
    case "INVALID_TOKEN": return res.status(401).json({ error: "Google sign-in could not be confirmed. Please try again.", code: "GOOGLE_INVALID" });
    default: return null;
  }
}

// Confirms the Google token AND that it carries a nonce this server issued (single use).
async function verifyRequest(credential) {
  const payload = await verifyGoogleIdToken(credential, { clientId: process.env.GOOGLE_CLIENT_ID });
  if (!nonces.consume(payload.nonce)) {
    const e = new Error("bad nonce"); e.code = "EXPIRED"; throw e;
  }
  return payload;
}

// GET /api/auth/google/nonce
exports.nonce = (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google sign-in is not set up yet.", code: "GOOGLE_NOT_CONFIGURED" });
  res.json({ nonce: nonces.issue(), clientId: process.env.GOOGLE_CLIENT_ID }); // the client id is public by design
};

// POST /api/auth/google  { credential, role? }
exports.signIn = async (req, res) => {
  try {
    let g;
    try { g = await verifyRequest(req.body.credential); } catch (err) { if (sendGoogleError(res, err)) return; throw err; }

    const email = g.email.toLowerCase();
    let user = await User.findOne({ googleId: g.sub });

    if (!user) {
      const sameEmail = await User.findOne({ email });
      if (sameEmail) {
        // Never merge silently. The owner proves control by logging in the usual way, then links Google from their dashboard.
        return res.status(409).json({
          error: "An account with this email already exists. Log in with your password, then link Google from your dashboard.",
          code: "ACCOUNT_EXISTS",
        });
      }
      try {
        user = await User.create({
          firstName: g.given_name || (g.name ? g.name.split(" ")[0] : "Student"),
          lastName: g.family_name || "",
          email,
          googleId: g.sub,
          role: req.body.role, // validated: student or parent only
          isVerified: true,    // Google has verified this email address
          country: "Nigeria",
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        user = await User.findOne({ googleId: g.sub }); // two requests at once: use the one that won
        if (!user) return res.status(409).json({ error: "An account with this email already exists.", code: "ACCOUNT_EXISTS" });
      }
    }

    const full = await ensureStudentId(await applyAdminAllowlist(user));
    const token = jwt.sign({ id: full._id, role: full.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: publicUser(full), created: !user.createdAt || Date.now() - new Date(user.createdAt).getTime() < 60000 });
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/google/link  { credential }  (signed in): attach a Google account whose email matches this account
exports.link = async (req, res) => {
  try {
    let g;
    try { g = await verifyRequest(req.body.credential); } catch (err) { if (sendGoogleError(res, err)) return; throw err; }

    const me = await User.findById(req.user.id);
    if (!me) return res.status(401).json({ error: "Account no longer exists" });
    if (me.googleId && me.googleId === g.sub) return res.json({ user: publicUser(me) });
    if (me.googleId) return res.status(409).json({ error: "A different Google account is already linked.", code: "ALREADY_LINKED" });
    if (g.email.toLowerCase() !== me.email) {
      return res.status(409).json({ error: "The Google account's email must match your iPrime email address.", code: "EMAIL_MISMATCH" });
    }
    const taken = await User.findOne({ googleId: g.sub });
    if (taken) return res.status(409).json({ error: "That Google account is already linked to another account.", code: "GOOGLE_IN_USE" });

    me.googleId = g.sub;
    await me.save();
    res.json({ user: publicUser(me) });
  } catch (err) { serverError(res, err); }
};
