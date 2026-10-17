const crypto = require("crypto");
const Otp = require("../models/Otp");
const sendEmail = require("./sendEmail");
const generateOtp = require("./generateOtp");

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Emails a fresh code (replacing any older one). Throws if no email provider is configured or sending fails.
async function issueOtp(email) {
  await Otp.deleteMany({ email });
  const code = generateOtp();
  await Otp.create({ email, otp: code });
  await sendEmail(email, code);
}

// true if the code was recent, unused and correct (and then it is used up). Wrong guesses are counted.
async function consumeOtp(email, code) {
  const record = await Otp.findOne({ email }).sort({ createdAt: -1 });
  if (!record) return false;
  if (record.attempts >= MAX_ATTEMPTS) { await Otp.deleteMany({ email }); return false; }
  if (!safeEqual(record.otp, code)) { record.attempts += 1; await record.save(); return false; }
  await Otp.deleteMany({ email });
  return true;
}

// ms since the newest code for this email was sent (Infinity if none): used to enforce the resend cooldown
async function msSinceLastOtp(email) {
  const latest = await Otp.findOne({ email }).sort({ createdAt: -1 });
  return latest ? Date.now() - latest.createdAt.getTime() : Infinity;
}

module.exports = { issueOtp, consumeOtp, msSinceLastOtp, COOLDOWN_MS };
