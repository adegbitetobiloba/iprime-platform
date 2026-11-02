const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/libraryValidation");
const c = require("../controllers/adminLibraryController");
const analytics = require("../controllers/adminLibraryAnalytics");
const mat = require("../controllers/adminLibraryMaterialsController");

// Mounted at /api/admin/library. Same protection as the rest of /api/admin:
// signed in, and the "admin" role is re-read from the database on every request.
router.use(protect, requireRole("admin"));
router.param("id", c.idParams);

router.get("/analytics", analytics.analytics);

router.post("/subjects/seed", mat.seedSubjects);
router.get("/materials", mat.listMaterials);
router.post("/materials", validate(v.material), mat.createMaterial);
router.patch("/materials/:id", validate(v.materialUpdate), mat.updateMaterial);
router.post("/materials/:id/status", validate(v.status), mat.setMaterialStatus);
router.put("/materials/:id/pdf", express.raw({ type: "application/pdf", limit: "20mb" }), mat.uploadMaterialPdf);
router.post("/materials/seed-syllabi", mat.seedSyllabi);
router.put("/materials/:id/images/order", validate(v.reorder), mat.reorderImages);
router.put("/materials/:id/images", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "8mb" }), mat.addImage);
router.delete("/materials/:id/images/:fileId", mat.removeImage);
router.get("/countdown", mat.getCountdown);
router.put("/countdown", validate(v.countdown), mat.saveCountdown);

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
router.put("/lessons/:id/pdf", express.raw({ type: "application/pdf", limit: "20mb" }), c.uploadPdf);
router.patch("/lessons/:id", validate(v.lessonUpdate), c.updateLesson);
router.delete("/lessons/:id", c.deleteLesson);

// Clear messages for upload problems instead of a generic 500.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large. The limit is 20 MB for PDFs and 8 MB for images." });
  return next(err);
});

module.exports = router;
