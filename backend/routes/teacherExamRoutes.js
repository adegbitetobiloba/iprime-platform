const express = require("express");
const router = express.Router();
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const c = require("../controllers/teacherExamController");

// Mounted at /api/teacher/exams (after protect + requireTeacher). There is deliberately NO publish, unpublish, live-control,
// attempts or question-bank route here: an administrator publishes after reviewing what the teacher submitted.
router.get("/", c.mine);
router.post("/", validate(v.createExam), c.create);
router.get("/:id", c.owned({ readOnly: true }), c.get);
router.patch("/:id", c.owned(), validate(v.updateExam), c.update);
router.delete("/:id", c.owned(), c.remove);
router.post("/:id/questions", c.owned(), validate(v.question), c.addQuestion);
router.post("/:id/questions/import", c.owned(), validate(v.importQuestions), c.importQuestions);
router.put("/:id/questions/:qid", c.owned(), validate(v.question), c.updateQuestion);
router.delete("/:id/questions/:qid", c.owned(), c.removeQuestion);
router.post("/:id/submit", c.owned(), c.submit);
router.post("/:id/withdraw", c.owned({ allowLocked: true }), c.withdraw);

module.exports = router;
