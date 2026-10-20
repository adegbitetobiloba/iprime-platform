const jwt = require("jsonwebtoken");
const RevokedToken = require("../models/RevokedToken");
const User = require("../models/User");
const { approvalBlock } = require("../utils/approval");

// Protects a route: requires "Authorization: Bearer <token>", and the login must not have been ended by Log out.
module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    if (payload.jti && (await RevokedToken.exists({ jti: payload.jti }))) {
      return res.status(401).json({ error: "You have been logged out. Please log in again." });
    }
    const account = await User.findById(payload.id).select("approval");
    const blocked = account && approvalBlock(account);
    if (blocked) return res.status(403).json({ error: blocked.error, code: blocked.code });
  } catch (err) {
    return next(err);
  }
  req.user = payload;
  next();
};
