const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/libraryValidation");
const c = require("../controllers/adminLibraryController");
const analytics = require("../controllers/adminLibraryAnalytics");

// Mounted at /api/admin/library. Same protection as the rest of /api/admin:
// signed in, and the "admin" role is re-read from the database on every request.
router.use(protect, requireRole("admin"));
router.param("id", c.idParams);

router.get("/analytics", analytics.analytics);

router.get("/subjects", c.listSubjects);
router.post("/subjects", validate(v.subject), c.createSubject);
router.patch("/subjects/:id", validate(v.subjectUpdate), c.updateSubject);

router.get("/courses", c.listCourses);
router.post("/courses", validate(v.course), c.createCourse);
router.get("/courses/:id", c.getCourse);
router.patch("/courses/:id", validate(v.courseUpdate), c.updateCourse);
router.post("/courses/:id/status", validate(v.status), c.setCourseStatus);

router.post("/courses/:id/modules", validate(v.module), c.createModule);
router.put("/courses/:id/modules/order", validate(v.reorder), c.reorderModules);
router.patch("/modules/:id", validate(v.moduleUpdate), c.updateModule);
router.delete("/modules/:id", c.deleteModule);

router.post("/modules/:id/lessons", validate(v.lesson), c.createLesson);
router.put("/modules/:id/lessons/order", validate(v.reorder), c.reorderLessons);
router.patch("/lessons/:id", validate(v.lessonUpdate), c.updateLesson);
router.delete("/lessons/:id", c.deleteLesson);

module.exports = router;
