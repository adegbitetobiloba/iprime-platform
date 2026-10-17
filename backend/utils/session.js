const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// The one place a login token is created. Each token has its own id (jti) so that Log out can end exactly this login.
const issueSession = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d", jwtid: crypto.randomUUID() });

module.exports = { issueSession };
