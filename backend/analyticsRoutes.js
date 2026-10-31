const express = require("express");
const router = express.Router();
const analytics = require("../controllers/studentAnalyticsController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// Own file and own mount so the analytics workstream does not touch the dashboard's routes.
router.use(protect, requireRole("student", "admin"));
router.get("/", analytics.analytics);

module.exports = router;
