const bcrypt = require("bcryptjs");
const User = require("../models/User");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Teachers have their own sign-in (/teacher/login). If a teacher's email is typed into the PUBLIC login form,
// answer exactly as for a wrong password, with similar timing, so the public form never reveals that a teacher account exists.
module.exports = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select("role");
    if (user && user.role === "teacher") {
      await bcrypt.compare(String(req.body.password || ""), DUMMY_HASH);
      return res.status(400).json({ error: "Invalid email or password" });
    }
    next();
  } catch (err) { next(err); }
};
