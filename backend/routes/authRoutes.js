const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { register, verifyOtp, resendOtp, login, me } = require("../controllers/authController");
const { schemas, validate } = require("../validations/authValidation");
const protect = require("../middleware/authMiddleware");

// Slows down password / OTP guessing from a single IP.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

router.post("/register", limiter, validate(schemas.register), register);
router.post("/verify-otp", limiter, validate(schemas.verifyOtp), verifyOtp);
router.post("/resend-otp", limiter, validate(schemas.resendOtp), resendOtp);
router.post("/login", limiter, validate(schemas.login), login);
router.get("/me", protect, me);

module.exports = router;
