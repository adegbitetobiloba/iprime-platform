const express = require("express");
const router = express.Router();
const c = require("../controllers/adminSettingsController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/accessValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")).
router.get("/enrolment", c.get);
router.put("/enrolment", validate(v.settings), c.put);

module.exports = router;
