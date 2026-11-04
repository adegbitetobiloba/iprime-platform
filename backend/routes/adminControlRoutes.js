const express = require("express");
const Joi = require("joi");
const router = express.Router();
const c = require("../controllers/adminControlController");
const { validate } = require("../validations/authValidation");

// Mounted under /api/admin/integrity/control, so it sits behind the admin check on /api/admin (the role is verified in the
// database on every request). Every action is written to the exam activity log with the administrator who did it.
const reason = Joi.string().trim().max(200).allow("");
const minutes = Joi.object({ minutes: Joi.number().integer().min(1).max(120).required(), reason });
const note = Joi.object({ reason });

router.get("/exams/:id/live", c.live);
router.post("/exams/:id/pause-all", validate(note), c.pauseAll);
router.post("/exams/:id/resume-all", validate(note), c.resumeAll);
router.post("/exams/:id/extend-all", validate(minutes), c.extendAll);
router.post("/attempts/:id/pause", validate(note), c.pause);
router.post("/attempts/:id/resume", validate(note), c.resume);
router.post("/attempts/:id/extend", validate(minutes), c.extend);
router.post("/attempts/:id/force-submit", validate(Joi.object({ mode: Joi.string().valid("ask", "now").required(), reason })), c.forceSubmit);
router.post("/attempts/:id/terminate", validate(note), c.terminate);

module.exports = router;
