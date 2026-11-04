const express = require("express");
const { validate } = require("../validations/authValidation");
const v = require("../validations/teacherValidation");
const c = require("../controllers/adminTeacherController");

// Mounted at /api/admin/teachers, inside adminRoutes: signed in, and the "admin" role re-read from the database on every request.
const router = express.Router();
router.param("id", c.idParam);

// Library submissions first, so "library" is never read as a teacher id.
router.get("/library/review", c.libraryReview);
router.post("/library/:id/decision", (req, res, next) => c.libIdParam(req, res, next, req.params.id), validate(v.libraryDecision), c.libraryDecision);

router.get("/", c.list);
router.get("/:id", c.get);
router.post("/:id/decision", validate(v.decision), c.decide);
router.get("/:id/students", c.listAssignments);
router.post("/:id/students", validate(v.assign), c.assignStudent);
router.delete("/:id/students/:studentId", c.unassignStudent);

module.exports = router;
