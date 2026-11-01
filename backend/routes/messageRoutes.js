const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const c = require("../controllers/messageController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/messageValidation");

// Students only. There is no recipient in any of these routes: a student can only ever write to the administration team.
router.use(protect, requireRole("student"));

// Stops one account flooding the administrators. Counted per student, not per network address.
const sendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => String(req.user.id), message: { error: "You are sending messages too quickly. Please wait a few minutes." } });

router.get("/thread", c.thread);
router.get("/unread", c.unread);
router.post("/read", c.markRead);
router.post("/", sendLimiter, validate(v.studentSend), c.send);

module.exports = router;
