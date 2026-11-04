const bcrypt = require("bcryptjs");
const User = require("../models/User");
const publicUser = require("../utils/publicUser");
const { issueOtp, consumeOtp, msSinceLastOtp, COOLDOWN_MS } = require("../utils/otpService");
const { issueSession } = require("../utils/session");
const { approvalBlock } = require("../utils/approval");
const { notifyAdminsNewTeacher } = require("../utils/teacherNotify");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10); // so a wrong email takes as long as a wrong password
const INVALID = "Invalid email or password";

// POST /api/teacher/auth/apply  (public, rate-limited)
// Creates a PENDING teacher application. The role and approval come from the server, never from the request body.
exports.apply = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, state, subjects, qualification, bio, yearsExperience } = req.body;
    const existing = await User.findOne({ email });
    // Only an unfinished (unverified) application can be re-submitted. A verified account, or any admin, is never touched.
    if (existing && (existing.isVerified || existing.role === "admin")) {
      return res.status(400).json({ error: "An account with this email already exists. If it is yours, sign in instead." });
    }
    const hashed = await bcrypt.hash(password, 10);
    const fields = {
      firstName, lastName, phone, state, role: "teacher", approval: "pending",
      teacherProfile: { subjects, qualification, bio: bio || undefined, yearsExperience, appliedAt: new Date() },
    };
    if (existing) { Object.assign(existing, fields, { password: hashed }); await existing.save(); }
    else await User.create({ ...fields, email, password: hashed });

    try { await issueOtp(email); }
    catch (err) {
      console.error("Teacher OTP email failed:", err.message);
      return res.status(502).json({ error: "Your application was saved, but we could not send the verification email. Please use Resend code.", code: "EMAIL_FAILED" });
    }
    res.status(201).json({ message: "Application received. Enter the code we emailed you to verify your address." });
  } catch (err) {
    if (err && err.code === 11000) return res.status(400).json({ error: "An account with this email already exists." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};

// POST /api/teacher/auth/verify-otp
// Proves the email address belongs to the applicant. It does NOT approve anything: an administrator still has to.
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const ok = await consumeOtp(email, otp);
    const user = ok ? await User.findOne({ email }) : null;
    if (!ok || !user || user.role !== "teacher") return res.status(400).json({ error: "Invalid or expired code" });
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
      await notifyAdminsNewTeacher(user);
    }
    res.json({ message: "Email verified. An administrator will review your application and email you when it is approved.", status: user.approval || "pending" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};

// POST /api/teacher/auth/resend-otp  (same answer whether or not the email exists)
exports.resendOtp = async (req, res) => {
  const generic = { message: "If an unverified teacher application exists for this email, a new code has been sent." };
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || user.role !== "teacher" || user.isVerified) return res.json(generic);
    const since = await msSinceLastOtp(user.email);
    if (since !== null && since < COOLDOWN_MS) return res.status(429).json({ error: "Please wait a minute before asking for another code." });
    await issueOtp(user.email);
    res.json(generic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send the code. Please try again." });
  }
};

// POST /api/teacher/auth/login
// A student, parent or admin cannot sign in here: they get the same answer as a wrong password.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(password, user && user.password ? user.password : DUMMY_HASH);
    if (!user || !ok || user.role !== "teacher") return res.status(400).json({ error: INVALID });
    if (!user.isVerified) return res.status(403).json({ error: "Please verify your email first.", code: "NOT_VERIFIED" });
    const block = approvalBlock(user);
    if (block) return res.status(403).json({ error: block.error, code: block.code });
    // Teacher accounts need an explicit approval; one with no approval value is treated as still waiting.
    if (user.approval !== "approved") return res.status(403).json({ error: "Your teacher account is waiting for approval by an administrator.", code: "PENDING_APPROVAL" });
    res.json({ token: issueSession(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
};

// GET /api/teacher/me
exports.me = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: publicUser(user) });
};

// PATCH /api/teacher/profile  (only the listed fields; role, approval and email can never be changed here)
exports.updateProfile = async (req, res) => {
  const b = req.body;
  const set = {};
  if (b.phone !== undefined) set.phone = b.phone;
  if (b.state !== undefined) set.state = b.state;
  if (b.subjects !== undefined) set["teacherProfile.subjects"] = b.subjects;
  if (b.qualification !== undefined) set["teacherProfile.qualification"] = b.qualification;
  if (b.bio !== undefined) set["teacherProfile.bio"] = b.bio;
  if (b.yearsExperience !== undefined) set["teacherProfile.yearsExperience"] = b.yearsExperience;
  const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true, runValidators: true });
  res.json({ user: publicUser(user) });
};
