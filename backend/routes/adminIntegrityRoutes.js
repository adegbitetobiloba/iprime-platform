const express = require("express");
const router = express.Router();
const c = require("../controllers/adminIntegrityController");

// Mounted under /api/admin, which already requires a signed-in administrator (checked against the database on every request).
router.use("/control", require("./adminControlRoutes")); // live exam control: monitor, pause, add time, ask to submit, terminate
router.get("/exams/:id", c.exam);
router.get("/attempts/:id/events", c.events);

module.exports = router;
