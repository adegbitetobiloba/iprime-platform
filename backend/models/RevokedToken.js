const mongoose = require("mongoose");

// Logins that were ended by "Log out". The database removes each entry by itself once the login would have expired anyway.
const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
