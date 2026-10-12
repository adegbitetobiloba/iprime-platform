const express = require("express");
const router = express.Router();
const c = require("../controllers/examController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const cbt = require("../validations/cbtValidation");

// Examinations are taken by students. Administrators may also take them, to test what students will see.
// The role is checked against the database on every request, not trusted from the token alone.
router.use(protect, requireRole("student", "admin"));

router.get("/exams", c.listExams);
router.get("/exams/:id", c.getExam);
router.post("/exams/:id/start", c.startAttempt);
router.get("/attempts", c.history);
router.get("/attempts/:id", c.getAttempt);
router.put("/attempts/:id/answers", validate(cbt.saveAnswer), c.saveAnswer);
router.post("/attempts/:id/submit", c.submitAttempt);
router.get("/attempts/:id/result", c.result);

module.exports = router;
