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
const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || "anonymous"),
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) => res.status(429).json({ error: "You are saving too quickly. Please wait a moment.", code: "RATE_LIMITED" }),
});

router.get("/exams", c.listExams);
router.get("/exams/:id", c.getExam);
router.post("/exams/:id/start", c.startAttempt);
router.get("/attempts", c.history);
router.get("/attempts/:id", c.getAttempt);
router.put("/attempts/:id/answers", saveLimiter, validate(cbt.saveAnswer), c.saveAnswer);
router.post("/attempts/:id/submit", c.submitAttempt);
router.get("/attempts/:id/result", c.result);

module.exports = router;
