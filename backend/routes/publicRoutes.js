const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { publicList } = require("../controllers/programmeController");
const achievers = require("../controllers/achieverController");

// Public, read-only content for the website. No sign-in needed, so it is rate limited.
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Please slow down." } });

router.get("/programmes", limiter, publicList);
router.get("/achievements", limiter, achievers.publicList);   // only published, verified and consented achievements

module.exports = router;
