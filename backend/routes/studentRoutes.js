const express = require("express");
const router = express.Router();
const c = require("../controllers/studentDashboardController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// Student-facing summaries. The role is re-read from the database on every request (see roleMiddleware).
// Administrators are allowed so they can see what students see, exactly as for the examination routes.
router.use(protect, requireRole("student", "admin"));

router.get("/dashboard", c.dashboard);

module.exports = router;
