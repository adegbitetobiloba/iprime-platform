// Examiner controls for sharing and access. Mounted inside adminRoutes (so it is already admin-only).
const express = require("express");
const c = require("../controllers/adminAccessController");

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => { console.error(err); res.status(500).json({ error: "Something went wrong on our side. Please try again." }); });

router.get("/exams/:id", wrap(c.get));
router.put("/exams/:id", wrap(c.putAccess));
router.put("/exams/:id/password", wrap(c.putPassword));
router.delete("/exams/:id/password", wrap(c.deletePassword));
router.post("/exams/:id/shares", wrap(c.createShare));
router.delete("/shares/:shareId", wrap(c.revokeShare));
router.get("/shares/:shareId/entries", wrap(c.entries));

module.exports = router;
