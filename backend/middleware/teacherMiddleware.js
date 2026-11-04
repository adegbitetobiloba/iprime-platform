const User = require("../models/User");

// Use after authMiddleware. Lets only an APPROVED, email-verified teacher through. Everything is re-read from the
// database on every request, so approving, rejecting or suspending a teacher takes effect immediately, not when their token expires.
// Stricter than students: a teacher account with no approval value at all (created before this feature) is NOT let in until an administrator approves it.
module.exports = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id).select("role isVerified approval firstName lastName");
    if (!u || !u.isVerified || u.role !== "teacher" || u.approval !== "approved") {
      return res.status(403).json({ error: "Teacher access is not available for this account.", code: "TEACHER_ACCESS_DENIED" });
    }
    req.teacher = u;
    req.user.role = "teacher";
    next();
  } catch (err) { next(err); }
};
