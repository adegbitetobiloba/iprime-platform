const express = require("express");
const router = express.Router();
const c = require("../controllers/enrolmentController");
const protect = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { validate } = require("../validations/authValidation");
const v = require("../validations/enrolmentValidation");

// Students only. The server re-reads the role from the database on every request.
router.use(protect, requireRole("student"));
router.post("/", validate(v.createDraft), c.create);
router.get("/mine", c.mine); // must stay above "/:id"
router.get("/:id", c.getOne);
router.patch("/:id", validate(v.saveDraft), c.save);
router.post("/:id/submit", validate(v.submit), c.submit);

module.exports = router;
