const express = require("express");
const router = express.Router();
const c = require("../controllers/adminAnalyticsController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// Administrators only (role re-read from the database). Teacher access waits for the Admin workstream's permission model.
router.use(protect, requireRole("admin"));
router.get("/exams/:examId", c.examCohort);

module.exports = router;
