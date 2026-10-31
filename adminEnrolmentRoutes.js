const express = require("express");
const router = express.Router();
const c = require("../controllers/adminEnrolmentController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/enrolmentValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")), so every route here is admin-only.
router.get("/", c.list);
router.get("/summary", c.summary); // must stay above "/:id"
router.get("/:id", c.get);
router.patch("/:id/office", validate(v.officeUpdate), c.updateOffice);
router.post("/:id/start-review", c.startReview);
router.post("/:id/request-info", validate(v.reviewNote), c.requestInfo);
router.post("/:id/approve", validate(v.reviewNote), c.approve);
router.post("/:id/reject", validate(v.reviewNote), c.reject);

module.exports = router;
