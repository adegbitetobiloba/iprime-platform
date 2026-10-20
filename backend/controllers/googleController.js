const bcrypt = require("bcryptjs");
const User = require("../models/User");
const publicUser = require("../utils/publicUser");
const { issueSession } = require("../utils/session");
const { ensureStudentId } = require("../utils/studentId");
const { applyAdminAllowlist } = require("../utils/adminAllowlist");
const { verifyGoogleIdToken, createNonceStore } = require("../utils/googleAuth");
const { signShortToken, verifyShortToken } = require("../utils/shortToken");
const { decideGoogleOutcome, maskEmail } = require("../utils/googleOutcome");
const { issueOtp, consumeOtp, msSinceLastOtp, COOLDOWN_MS } = require("../utils/otpService");
const { initialApproval, approvalBlock } = require("../utils/approval");
const { notifyAdminsNewStudent } = require("../utils/notify");

const nonces = createNonceStore();
const SETUP_TTL = 15 * 60; // seconds to finish choosing an account type
const LINK_TTL = 10 * 60;  // seconds to prove ownership of an existing account

// A dummy hash so a wrong password takes about as long whether or not the account has one
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

// Turns a verification failure into a plain response. Token contents are never echoed back or logged.
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

// The Google token must be genuine AND carry a nonce this server issued (single use, so it cannot be replayed).
async function verifyRequest(credential) {
  const payload = await verifyGoogleIdToken(credential, { clientId: process.env.GOOGLE_CLIENT_ID });
  if (!nonces.consume(payload.nonce)) { const e = new Error("bad nonce"); e.code = "EXPIRED"; throw e; }
  return payload;
}

// Signs a person in: admin allow-list and student ID are applied the same way as for a password login.
async function signedIn(res, user, extra = {}) {
  const block = approvalBlock(user);
  if (block) {
    // Google proved who they are, so it is safe to tell them where they stand. No login token is issued.
    if (block.status === "rejected") return res.status(403).json({ error: block.error, code: block.code });
    return res.json({ status: "pending_approval", email: user.email, message: block.error });
  }
  const full = await ensureStudentId(await applyAdminAllowlist(user));
  res.json({ status: "signed_in", token: issueSession(full), user: publicUser(full), ...extra });
}

const namesFrom = (g) => ({
  firstName: g.given_name || (g.name ? g.name.split(" ")[0] : "") || "Friend",
  lastName: g.family_name || "",
});

function newAccountFields(g, role, alumni = {}) {
  const fields = { ...namesFrom(g), email: g.email.toLowerCase(), googleId: g.sub, role, isVerified: true, country: "Nigeria", approval: initialApproval(role) };
  if (role === "alumni") { fields.alumniStatus = "unverified"; fields.alumni = { graduationYear: alumni.graduationYear, lastClass: alumni.lastClass }; }
  return fields;
}

// GET /api/auth/google/nonce
exports.nonce = (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google sign-in is not set up yet.", code: "GOOGLE_NOT_CONFIGURED" });
  res.json({ nonce: nonces.issue(), clientId: process.env.GOOGLE_CLIENT_ID }); // the client id is public by design
};

// POST /api/auth/google  { credential, role? }
// One of: signed_in | link_required | onboarding | (409) conflict
exports.signIn = async (req, res) => {
  try {
    let g;
    try { g = await verifyRequest(req.body.credential); } catch (err) { if (sendGoogleError(res, err)) return; throw err; }

    const email = g.email.toLowerCase();
    const [byGoogleId, byEmail] = await Promise.all([User.findOne({ googleId: g.sub }), User.findOne({ email })]);
    const outcome = decideGoogleOutcome({ byGoogleId, byEmail, role: req.body.role });

    if (outcome === "sign_in") return signedIn(res, byGoogleId);

    if (outcome === "conflict") {
      return res.status(409).json({ error: "This email is already connected to a different Google account. Sign in with that Google account, or log in with your password.", code: "DIFFERENT_GOOGLE_ACCOUNT" });
    }

    if (outcome === "link_required") {
      // An iPrime account with this email exists. Nothing is merged until the person proves they own it.
      const usable = byEmail.isVerified && byEmail.password; // a password only counts if the email was verified (anyone could have typed an unverified one)
      return res.json({
        status: "link_required",
        email: maskEmail(email),
        methods: usable ? ["password", "code"] : ["code"],
        linkToken: signShortToken({ purpose: "google-link", uid: String(byEmail._id), sub: g.sub, email }, process.env.JWT_SECRET, LINK_TTL),
      });
    }

    if (outcome === "onboarding") {
      return res.json({
        status: "onboarding",
        profile: { ...namesFrom(g), email },
        setupToken: signShortToken({ purpose: "google-setup", sub: g.sub, email, given: g.given_name || "", family: g.family_name || "", name: g.name || "" }, process.env.JWT_SECRET, SETUP_TTL),
      });
    }

    // outcome === "create": the person already chose their account type on the sign-up page
    try {
      const created = await User.create(newAccountFields(g, req.body.role));
      if (approvalBlock(created)) notifyAdminsNewStudent(created);
      return signedIn(res, created);
    } catch (err) {
      if (err.code !== 11000) throw err;
      const winner = await User.findOne({ googleId: g.sub });
      if (winner) return signedIn(res, winner);
      return res.status(409).json({ error: "An account with this email already exists.", code: "ACCOUNT_EXISTS" });
    }
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/google/complete  { setupToken, role, graduationYear?, lastClass? }
// Second step for a brand-new Google user: they choose what kind of account to open. Only student, parent or alumni are possible.
exports.complete = async (req, res) => {
  try {
    const setup = verifyShortToken(req.body.setupToken, process.env.JWT_SECRET, "google-setup");
    if (!setup) return res.status(401).json({ error: "This step expired. Please sign in with Google again.", code: "SETUP_EXPIRED" });
    const g = { sub: setup.sub, email: setup.email, given_name: setup.given, family_name: setup.family, name: setup.name };

    const [byGoogleId, byEmail] = await Promise.all([User.findOne({ googleId: g.sub }), User.findOne({ email: g.email })]);
    if (byGoogleId) return signedIn(res, byGoogleId);
    if (byEmail) return res.status(409).json({ error: "An account with this email already exists. Please sign in with Google again.", code: "ACCOUNT_EXISTS" });

    try {
      const created = await User.create(newAccountFields(g, req.body.role, { graduationYear: req.body.graduationYear, lastClass: req.body.lastClass }));
      if (approvalBlock(created)) notifyAdminsNewStudent(created);
      return signedIn(res, created);
    } catch (err) {
      if (err.code !== 11000) throw err;
      const winner = await User.findOne({ googleId: g.sub });
      if (winner) return signedIn(res, winner);
      throw err;
    }
  } catch (err) { serverError(res, err); }
};

// Shared by the two "prove it is yours" routes: attaches the Google identity to the existing account.
async function finishLink(res, link, user) {
  const taken = await User.findOne({ googleId: link.sub });
  if (taken && String(taken._id) !== String(user._id)) {
    return res.status(409).json({ error: "That Google account is already linked to another account.", code: "GOOGLE_IN_USE" });
  }
  if (user.googleId && user.googleId !== link.sub) {
    return res.status(409).json({ error: "A different Google account is already linked.", code: "DIFFERENT_GOOGLE_ACCOUNT" });
  }
  user.googleId = link.sub;
  if (!user.isVerified) {
    // The email was never verified before. Google has now verified it, so this person owns it; any password
    // set earlier by someone else is removed so it cannot be used to enter the account.
    user.isVerified = true;
    user.password = undefined;
  }
  await user.save();
  return signedIn(res, user, { linked: true });
}

async function loadLinkTarget(res, linkToken) {
  const link = verifyShortToken(linkToken, process.env.JWT_SECRET, "google-link");
  if (!link) { res.status(401).json({ error: "This step expired. Please sign in with Google again.", code: "LINK_EXPIRED" }); return {}; }
  const user = await User.findById(link.uid);
  if (!user || user.email !== link.email) { res.status(404).json({ error: "We could not find that account." }); return {}; }
  return { link, user };
}

// POST /api/auth/google/link-existing  { linkToken, password }
exports.linkWithPassword = async (req, res) => {
  try {
    const { link, user } = await loadLinkTarget(res, req.body.linkToken);
    if (!link) return;
    const usable = user.isVerified && user.password;
    const ok = await bcrypt.compare(req.body.password, usable ? user.password : DUMMY_HASH);
    if (!usable || !ok) return res.status(401).json({ error: "That password is not correct.", code: "WRONG_PASSWORD" });
    await finishLink(res, link, user);
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/google/link-code/send  { linkToken }  (emails a 6-digit code to the account's own address)
exports.sendLinkCode = async (req, res) => {
  try {
    const { link, user } = await loadLinkTarget(res, req.body.linkToken);
    if (!link) return;
    if ((await msSinceLastOtp(user.email)) < COOLDOWN_MS) return res.status(429).json({ error: "Please wait a minute before asking for another code." });
    try { await issueOtp(user.email); } catch (err) {
      console.error("Link code email failed:", err.message);
      return res.status(502).json({ error: "We could not send the email right now. Please try again later.", code: "EMAIL_FAILED" });
    }
    res.json({ message: "We emailed a 6-digit code to the address on that account.", email: maskEmail(user.email) });
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/google/link-code/confirm  { linkToken, code }
exports.confirmLinkCode = async (req, res) => {
  try {
    const { link, user } = await loadLinkTarget(res, req.body.linkToken);
    if (!link) return;
    if (!(await consumeOtp(user.email, req.body.code))) return res.status(401).json({ error: "That code is not correct or has expired.", code: "WRONG_CODE" });
    await finishLink(res, link, user);
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/google/link  { credential }  (already signed in): attach a Google account whose email matches this account
exports.link = async (req, res) => {
  try {
    let g;
    try { g = await verifyRequest(req.body.credential); } catch (err) { if (sendGoogleError(res, err)) return; throw err; }

    const me = await User.findById(req.user.id);
    if (!me) return res.status(401).json({ error: "Account no longer exists" });
    if (me.googleId && me.googleId === g.sub) return res.json({ user: publicUser(me) });
    if (me.googleId) return res.status(409).json({ error: "A different Google account is already linked.", code: "ALREADY_LINKED" });
    if (g.email.toLowerCase() !== me.email) return res.status(409).json({ error: "The Google account's email must match your iPrime email address.", code: "EMAIL_MISMATCH" });
    const taken = await User.findOne({ googleId: g.sub });
    if (taken) return res.status(409).json({ error: "That Google account is already linked to another account.", code: "GOOGLE_IN_USE" });

    me.googleId = g.sub;
    await me.save();
    res.json({ user: publicUser(me) });
  } catch (err) { serverError(res, err); }
};
