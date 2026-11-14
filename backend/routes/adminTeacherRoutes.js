const express = require("express");
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const c = require("../controllers/adminTeacherController");

// Mounted at /api/admin/teachers, inside adminRoutes: signed in, and the "admin" role re-read from the database on every request.
const router = express.Router();
router.param("id", c.idParam);

// Fixed paths first, so "library", "submissions" and "options" are never read as a teacher id.
router.get("/summary", c.summary);
router.get("/options/subjects", c.subjectOptions);
router.get("/options/count", c.groupPreview);
router.get("/library/review", c.libraryReview);
router.post("/library/:id/decision", (req, res, next) => c.libIdParam(req, res, next, req.params.id), validate(v.libraryDecision), c.libraryDecision);
router.get("/submissions", c.submissions);
router.post("/submissions/:id/decision", validate(v.submissionDecision), c.submissionDecision);

router.get("/", c.list);
router.get("/:id", c.get);
router.post("/:id/decision", validate(v.decision), c.decide);
router.get("/:id/students", c.listAssignments);
router.post("/:id/students", validate(v.assign), c.assignStudent);
router.delete("/:id/students/:studentId", c.unassignStudent);
router.get("/:id/groups", c.listGroups);
router.post("/:id/groups", validate(v.group), c.addGroup);
router.delete("/:id/groups/:groupId", c.removeGroup);

module.exports = router;
