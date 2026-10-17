const express = require("express");
const router = express.Router();
const c = require("../controllers/adminExamController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const cbt = require("../validations/cbtValidation");
const prog = require("../controllers/programmeController");
const users = require("../controllers/adminUserController");
const progV = require("../validations/programmeValidation");

// Everything under /api/admin requires a signed-in account whose role is "admin" in the database.
router.use(protect, requireRole("admin"));

router.get("/overview", users.overview);
router.get("/students", users.listStudents);
router.get("/students/:id", users.getStudent);
router.patch("/alumni/:id", users.reviewAlumni);
router.get("/exams", c.list);
router.post("/exams", validate(cbt.createExam), c.create);
router.get("/exams/:id", c.get);
router.patch("/exams/:id", validate(cbt.updateExam), c.update);
router.delete("/exams/:id", c.remove);
router.post("/exams/:id/questions", validate(cbt.question), c.addQuestion);
router.post("/exams/:id/questions/import", validate(cbt.importQuestions), c.importQuestions);
router.put("/exams/:id/questions/:qid", validate(cbt.question), c.updateQuestion);
router.delete("/exams/:id/questions/:qid", c.removeQuestion);
router.post("/exams/:id/publish", c.publish);
router.post("/exams/:id/unpublish", c.unpublish);
router.get("/exams/:id/attempts", c.attempts);

router.get("/programmes", prog.adminList);
router.post("/programmes", validate(progV.createProgramme), prog.create);
router.patch("/programmes/:id", validate(progV.updateProgramme), prog.update);
router.delete("/programmes/:id", prog.remove);

module.exports = router;
