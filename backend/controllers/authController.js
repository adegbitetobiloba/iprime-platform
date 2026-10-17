const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { ensureStudentId } = require("../utils/studentId");
const { applyAdminAllowlist } = require("../utils/adminAllowlist");

const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

// Compared against when the email is unknown, so login takes about the same time either way.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const publicUser = require("../utils/publicUser");

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

const { issueOtp } = require("../utils/otpService");
const { issueSession } = require("../utils/session");
const RevokedToken = require("../models/RevokedToken");

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, graduationYear, lastClass, ...profile } = req.body;
    if (profile.role === "alumni") {
      profile.alumniStatus = "unverified"; // a claim, until staff confirm it
      profile.alumni = { graduationYear, lastClass };
    }
    const existing = await User.findOne({ email });

    if (existing && existing.isVerified) {
      return res.status(400).json({ error: "An account with this email already exists. Please log in." });
    }

    const hashed = await bcrypt.hash(password, 10);

    if (existing) {
      // Signed up before but never verified: update details and send a new code.
      Object.assign(existing, profile, { password: hashed });
      await existing.save();
    } else {
      await User.create({ ...profile, email, password: hashed });
    }

    try {
      await issueOtp(email);
    } catch (err) {
      console.error("OTP email failed:", err.message);
      return res.status(502).json({
        error: "Your account was created, but we couldn't send the verification email. Use 'Resend code' on the next page.",
        code: "EMAIL_FAILED",
      });
    }

    res.json({ message: "Verification code sent to your email" });
  } catch (err) {
    serverError(res, err);
  }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ error: "Invalid or expired code. Request a new one." });
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.deleteMany({ email });
      return res.status(400).json({ error: "Too many wrong attempts. Request a new code." });
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const user = await User.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
    await Otp.deleteMany({ email });

    if (!user) return res.status(400).json({ error: "Account not found" });
    await ensureStudentId(user);
    res.json({ message: "Account verified" });
  } catch (err) {
    serverError(res, err);
  }
};

// POST /api/auth/resend-otp
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const generic = { message: "If this account exists and is not yet verified, a new code was sent." };

    const user = await User.findOne({ email });
    if (!user || user.isVerified) return res.json(generic); // don't reveal which emails exist

    const latest = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: "Please wait a minute before requesting another code." });
    }

    try {
      await issueOtp(email);
    } catch (err) {
      console.error("OTP email failed:", err.message);
      return res.status(502).json({ error: "We couldn't send the email right now. Please try again later.", code: "EMAIL_FAILED" });
    }

    res.json(generic);
  } catch (err) {
    serverError(res, err);
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Same message and similar timing for "no such user" and "wrong password".
    const passwordOk = await bcrypt.compare(password, user && user.password ? user.password : DUMMY_HASH); // Google-only accounts have no password
    if (!user || !passwordOk) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email first", code: "NOT_VERIFIED" });
    }

    const full = await ensureStudentId(await applyAdminAllowlist(user)); // existing students get their ID on first login
    const token = issueSession(full);
    res.json({ token, user: publicUser(full) });
  } catch (err) {
    serverError(res, err);
  }
};

// GET /api/auth/me (protected): lets the frontend check a stored token is still valid
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    res.json({ user: publicUser(await ensureStudentId(await applyAdminAllowlist(user))) });
  } catch (err) {
    serverError(res, err);
  }
};

// PATCH /api/auth/me (protected): edit the signed-in user's own profile.
// The account is identified ONLY by the verified token (req.user.id), never by an id sent by the browser,
// and only the fields listed below are written, so role, email, password and isVerified cannot be changed here.
exports.updateMe = async (req, res) => {
  try {
    const { firstName, lastName, otherNames, phone, state, dob } = req.body;
    const set = { firstName, lastName, phone, state, otherNames: otherNames || "" };
    const update = { $set: set };
    if (dob) set.dob = dob;
    else update.$unset = { dob: "" };
    if (req.body.graduationYear !== undefined || req.body.lastClass !== undefined) {
      const me = await User.findById(req.user.id).select("role");
      if (me && me.role === "alumni") { // only alumni have these details
        if (req.body.graduationYear !== undefined) set["alumni.graduationYear"] = req.body.graduationYear;
        if (req.body.lastClass !== undefined) set["alumni.lastClass"] = req.body.lastClass;
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    res.json({ user: publicUser(user) });
  } catch (err) {
    serverError(res, err);
  }
};

// POST /api/auth/logout (protected): ends THIS login on the server, so the token stops working even if someone copied it.
exports.logout = async (req, res) => {
  try {
    if (req.user.jti && req.user.exp) {
      await RevokedToken.updateOne({ jti: req.user.jti }, { $setOnInsert: { jti: req.user.jti, expiresAt: new Date(req.user.exp * 1000) } }, { upsert: true });
    }
    res.json({ message: "Logged out" });
  } catch (err) { serverError(res, err); }
};

// GET /api/auth/admin-status (protected): lets the signed-in person see why they do or do not have administrator access.
// It only ever describes the caller's own account.
exports.adminStatus = async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("email role isVerified");
    if (!me) return res.status(401).json({ error: "Account no longer exists" });
    const list = (process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    res.json({ role: me.role, emailVerified: me.isVerified, adminListConfigured: list.length > 0, emailOnAdminList: list.includes(me.email) });
  } catch (err) { serverError(res, err); }
};

// POST /api/auth/alumni/request-verification (protected, alumni only)
exports.requestAlumniVerification = async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me || me.role !== "alumni") return res.status(403).json({ error: "This is only for alumni accounts." });
    if (me.alumniStatus === "verified") return res.status(409).json({ error: "You are already verified." });
    if (me.alumniStatus === "pending") return res.status(409).json({ error: "Your request is already waiting for review." });
    me.alumniStatus = "pending";
    if (req.body.note !== undefined) me.set("alumni.note", req.body.note);
    await me.save();
    res.json({ user: publicUser(me) });
  } catch (err) { serverError(res, err); }
};
