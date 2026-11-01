const express = require("express");
const router = express.Router();
const c = require("../controllers/adminMessageController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/messageValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")), so every route here is admin-only.
router.get("/summary", c.summary);
router.get("/conversations", c.conversations);
router.get("/students", c.searchStudents);
router.get("/students/:studentId", c.thread);
router.get("/students/:studentId/attempts", c.attempts);
router.post("/students/:studentId", validate(v.adminSend), c.send);
router.post("/students/:studentId/read", c.markRead);

module.exports = router;
