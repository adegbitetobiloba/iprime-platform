const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const c = require("../controllers/teacherCourseController");

// Mounted at /api/teacher/courses (after protect + requireTeacher). Every write passes an ownership check first:
// your own course, still a draft, not waiting for review. The library code then does the work, exactly as for administrators.
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many uploads. Please wait a moment." } });
const g = c.guard;

router.get("/", c.mine);
router.post("/", validate(v.course), c.create);
router.get("/:id", g({ via: "course", readOnly: true }), c.get);
router.patch("/:id", g({ via: "course" }), validate(v.courseUpdate), c.update);
router.post("/:id/submit", g({ via: "course" }), c.submit);
router.post("/:id/withdraw", g({ via: "course", allowLocked: true }), c.withdraw);

router.post("/:id/modules", g({ via: "course" }), validate(v.module), c.createModule);
router.put("/:id/modules/order", g({ via: "course" }), validate(v.reorder), c.reorderModules);
router.patch("/modules/:id", g({ via: "module" }), validate(v.moduleUpdate), c.updateModule);
router.delete("/modules/:id", g({ via: "module" }), c.deleteModule);

router.post("/modules/:id/lessons", g({ via: "module" }), validate(v.lesson), c.createLesson);
router.put("/modules/:id/lessons/order", g({ via: "module" }), validate(v.reorder), c.reorderLessons);
router.put("/lessons/:id/pdf", uploadLimiter, g({ via: "lesson" }), express.raw({ type: "application/pdf", limit: "20mb" }), c.uploadPdf);
router.patch("/lessons/:id", g({ via: "lesson" }), validate(v.lessonUpdate), c.updateLesson);
router.delete("/lessons/:id", g({ via: "lesson" }), c.deleteLesson);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large. The limit is 20 MB for PDFs." });
  return next(err);
});

module.exports = router;
