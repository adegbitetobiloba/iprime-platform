const express = require("express");
const router = express.Router();
const c = require("../controllers/teacherAnalyticsController");
const protect = require("../middleware/authMiddleware");
const requireTeacher = require("../middleware/teacherMiddleware");

// Own file and own mount (app.js) so the Teacher workstream's routes are not edited. The gate is repeated here on purpose.
router.use(protect, requireTeacher);
router.get("/students", c.list);
router.get("/students/:studentId", c.one);

module.exports = router;
