const express = require("express");
const router = express.Router();
const c = require("../controllers/adminMessageController");
const f = require("../controllers/messageFileController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/messageValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")), so every route here is admin-only.
const rawFile = express.raw({ type: ["image/png", "image/jpeg", "application/pdf"], limit: "2mb" });

router.get("/stream", c.stream);
router.get("/summary", c.summary);
router.get("/admins", c.admins);
router.get("/conversations", c.conversations);
router.get("/search", c.searchMessages);
router.get("/students", c.searchStudents);
router.get("/files/:id", f.downloadAdmin);
router.get("/students/:studentId", c.thread);
router.get("/students/:studentId/attempts", c.attempts);
router.post("/students/:studentId/files", rawFile, f.uploadAdmin);
router.post("/students/:studentId", validate(v.adminSend), c.send);
router.post("/students/:studentId/read", c.markRead);
router.post("/students/:studentId/block", validate(v.blockReason), c.block);
router.post("/students/:studentId/unblock", c.unblock);
router.post("/students/:studentId/assign", validate(v.assign), c.assign);

module.exports = router;
