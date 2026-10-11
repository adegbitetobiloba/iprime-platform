const User = require("../models/User");

// Use after authMiddleware: requireRole("admin") or requireRole("admin", "teacher").
// The role is re-read from the database, so a demoted account loses access immediately
// instead of keeping it until its token expires.
module.exports = (...roles) => async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("role isVerified");
    if (!user || !user.isVerified || !roles.includes(user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this" });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    next(err);
  }
};
