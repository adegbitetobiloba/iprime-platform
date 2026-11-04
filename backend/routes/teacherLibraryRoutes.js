const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const c = require("../controllers/teacherLibraryController");

// Mounted at /api/teacher/library, AFTER protect + requireTeacher in teacherRoutes (signed in, approved teacher, re-checked in the database each request).
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many uploads. Please wait a moment." } });
const fileLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Too many document requests. Please wait a moment." } });

// Read the library (published material, plus your own drafts)
router.get("/subjects", c.subjects);
router.get("/materials", c.browse);
router.get("/mine", c.mine);
router.get("/materials/:id/pdf", fileLimiter, c.stream);
router.get("/materials/:id/images/:fileId", fileLimiter, c.streamImage);
router.get("/materials/:id", c.getOne);

// Create and edit your own drafts
router.post("/materials", uploadLimiter, validate(v.material), c.create);
router.patch("/materials/:id", uploadLimiter, c.owned(), validate(v.materialUpdate), c.update);
router.put("/materials/:id/pdf", uploadLimiter, c.owned(), express.raw({ type: "application/pdf", limit: "20mb" }), c.uploadPdf);
router.put("/materials/:id/images/order", c.owned(), validate(v.reorder), c.reorderImages);
router.put("/materials/:id/images", uploadLimiter, c.owned(), express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "8mb" }), c.addImage);
router.delete("/materials/:id/images/:fileId", c.owned(), c.removeImage);
router.post("/materials/:id/submit", c.owned(), c.submit);
router.post("/materials/:id/withdraw", c.owned({ allowLocked: true }), c.withdraw);

// Clear messages for upload problems instead of a generic 500.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large. The limit is 20 MB for PDFs and 8 MB for images." });
  return next(err);
});

module.exports = router;
