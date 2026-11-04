const express = require("express");
const router = express.Router();
const c = require("../controllers/adminPeopleController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/accessValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")), so every route here is admin-only.
router.get("/", c.list);
router.get("/:id", c.record);
router.patch("/:id/features", validate(v.features), c.setFeatures);
router.post("/:id/payments", validate(v.payment), c.addPayment);
router.post("/:id/payments/:entryId/void", validate(v.voidReason), c.voidPayment);
router.post("/:id/verification", validate(v.verification), c.setVerification);
router.delete("/:id", validate(v.deleteAccount), c.remove);

module.exports = router;
