const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const c = require("../controllers/examController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const cbt = require("../validations/cbtValidation");

// Examinations are taken by students. Administrators may also take them, to test what students will see.
// The role is checked against the database on every request, not trusted from the token alone.
router.use(protect, requireRole("student", "admin"));

// Per-student limit on answer saving (not per IP, so a shared school network is not penalised). 240 a minute is
// far above honest use; the exam screen keeps unsent answers and retries, so hitting it only delays a save.
const limiter = (limit, message) => rateLimit({
  windowMs: 60 * 1000,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || "anonymous"),
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) => res.status(429).json({ error: message, code: "RATE_LIMITED" }),
});
const saveLimiter = limiter(240, "You are saving too quickly. Please wait a moment.");
const syncLimiter = limiter(30, "Too many submit attempts. Please wait a moment and try again.");
const eventLimiter = limiter(60, "Too many reports. Please wait a moment.");
const beatLimiter = limiter(30, "Too many check-ins. Please wait a moment.");

router.get("/exams", c.listExams);
router.get("/exams/:id", c.getExam);
router.post("/exams/:id/start", c.startAttempt);
router.get("/attempts", c.history);
router.get("/attempts/:id", c.getAttempt);
router.put("/attempts/:id/answers", saveLimiter, validate(cbt.saveAnswer), c.saveAnswer);
router.post("/attempts/:id/heartbeat", beatLimiter, c.heartbeat);
router.post("/attempts/:id/events", eventLimiter, validate(cbt.attemptEvents), c.recordEvents);
router.post("/attempts/:id/sync", syncLimiter, validate(cbt.syncAnswers), c.syncAttempt);
router.post("/attempts/:id/submit", c.submitAttempt);
router.get("/attempts/:id/result", c.result);

module.exports = router;
