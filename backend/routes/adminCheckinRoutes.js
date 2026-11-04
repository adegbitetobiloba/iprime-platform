const express = require("express");
const router = express.Router();
const c = require("../controllers/adminCheckinController");
const { validate } = require("../validations/authValidation");
const v = require("../validations/accessValidation");

// Mounted inside adminRoutes.js AFTER router.use(protect, requireRole("admin")).
router.get("/search", c.search);
router.get("/today", c.register);
router.post("/students/:id", validate(v.checkIn), c.checkIn);
router.post("/:id/void", validate(v.voidReason), c.voidCheckIn);

module.exports = router;
