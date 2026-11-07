// External share links and the examination password. Mounted at /api/share BEFORE cbtRoutes (which guards all of /api).
const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const access = require("../middleware/examAccess");
const c = require("../controllers/shareController");

const router = express.Router();
const limiter = (windowMs, n, keyFn) => rateLimit({ windowMs, max: n, limit: n, standardHeaders: true, legacyHeaders: false, ...(keyFn ? { keyGenerator: keyFn } : {}), message: { error: "Too many requests. Please try again later." } });
const publicLimit = limiter(10 * 60 * 1000, 120);
const enterLimit = limiter(10 * 60 * 1000, 20, (req) => `${ipKeyGenerator(req.ip)}:${req.params.token}`);       // guessing a password needs many tries
const unlockLimit = limiter(10 * 60 * 1000, 10, (req) => `${req.user && req.user.id}:${req.params.id}`);
const redeemLimit = limiter(10 * 60 * 1000, 30, (req) => String(req.user && req.user.id));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => { console.error(err); res.status(500).json({ error: "Something went wrong on our side. Please try again." }); });

router.get("/seb-check", publicLimit, wrap(c.sebCheck));
// Signed-in students/admins and guests holding a link session:
router.get("/exams/:id/status", protect, access.studentOrGuest, wrap(c.examStatus));
router.post("/exams/:id/unlock", protect, access.studentOrGuest, unlockLimit, wrap(c.unlock));
// The link itself:
router.get("/:token", publicLimit, wrap(c.info));
router.post("/:token/enter", enterLimit, wrap(c.enter));
router.post("/:token/redeem", protect, requireRole("student", "admin"), redeemLimit, wrap(c.redeem));

module.exports = router;
