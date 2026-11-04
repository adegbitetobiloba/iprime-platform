const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const requireTeacher = require("../middleware/teacherMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const auth = require("../controllers/teacherAuthController");
const students = require("../controllers/teacherStudentController");

// Mounted at /api/teacher. It MUST be mounted before app.use("/api", cbtRoutes), because that router
// lets only students and administrators through every /api path that reaches it.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT) || 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// ---- Public: apply and sign in (never linked from the public signup or login pages) ----
router.post("/auth/apply", strictLimiter, validate(v.apply), auth.apply);
router.post("/auth/verify-otp", strictLimiter, validate(v.verifyOtp), auth.verifyOtp);
router.post("/auth/resend-otp", limiter, validate(v.resendOtp), auth.resendOtp);
router.post("/auth/login", strictLimiter, validate(v.login), auth.login);

// ---- Everything below needs a signed-in, APPROVED teacher (checked in the database on every request) ----
router.use(protect, requireTeacher);
router.get("/me", auth.me);
router.patch("/profile", limiter, validate(v.profile), auth.updateProfile);
router.get("/students", students.list);
router.use("/library", require("./teacherLibraryRoutes"));

module.exports = router;
