const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/libraryValidation");
const c = require("../controllers/libraryController");

// Mounted at /api/library. It MUST be mounted before app.use("/api", cbtRoutes), because that router
// applies its own student-only check to every /api path that reaches it.
// Students read published content; admins may also open it (draft content is shown to admins as a preview and creates no learning records).
router.use(protect, requireRole("student", "admin"));
router.param("id", c.idParams);

// Progress is saved often (every few seconds while studying), so it has its own generous limit.
const progressLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: "Too many updates. Please slow down." } });

router.get("/home", c.home);
router.get("/courses", c.listCourses);
router.get("/search", c.search);
router.get("/courses/:slug", c.getCourse);
router.post("/courses/:id/enrol", c.enrol);

const pdfLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many document requests. Please wait a moment." } });
router.get("/lessons/:id/pdf", pdfLimiter, c.streamPdf);
router.get("/lessons/:id", c.getLesson);
router.put("/lessons/:id/progress", progressLimiter, validate(v.progress), c.saveProgress);
router.post("/lessons/:id/practice-check", c.checkPractice);
router.post("/lessons/:id/bookmark", c.addBookmark);
router.delete("/lessons/:id/bookmark", c.removeBookmark);
router.put("/lessons/:id/note", validate(v.note), c.saveNote);

router.get("/bookmarks", c.listBookmarks);
router.get("/me/summary", c.mySummary);

module.exports = router;
