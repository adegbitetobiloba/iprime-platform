const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const c = require("../controllers/messageController");
const f = require("../controllers/messageFileController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/messageValidation");

// Students only. There is no recipient in any of these routes: a student can only ever write to the administration team.
router.use(protect, requireRole("student"));

// Stops one account flooding the administrators. Counted per student, not per network address.
const perStudent = (windowMs, limit, error) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => String(req.user.id), message: { error } });
const sendLimiter = perStudent(10 * 60 * 1000, 20, "You are sending messages too quickly. Please wait a few minutes.");
const uploadLimiter = perStudent(10 * 60 * 1000, 10, "You are uploading files too quickly. Please wait a few minutes.");
const rawFile = express.raw({ type: ["image/png", "image/jpeg", "application/pdf"], limit: "2mb" }); // the file bytes are the request body

router.get("/thread", c.thread);
router.get("/unread", c.unread);
router.get("/stream", c.stream);
router.post("/read", c.markRead);
router.post("/files", uploadLimiter, rawFile, f.uploadStudent);
router.get("/files/:id", f.downloadStudent);
router.post("/", sendLimiter, validate(v.studentSend), c.send);

module.exports = router;
