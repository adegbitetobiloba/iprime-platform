const User = require("../models/User");

// Secure way to create the first administrator without putting credentials in code:
// the owner lists admin email addresses in the ADMIN_EMAILS environment variable on the server (comma-separated).
// An account is promoted only when its email address is VERIFIED (the owner has opened the OTP email),
// and the role is read from the database on every protected request. Registration itself can never set a role.
const listed = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function applyAdminAllowlist(user) {
  if (!user || !user.isVerified || user.role === "admin") return user;
  if (!listed().includes(String(user.email).toLowerCase())) return user;
  return (await User.findByIdAndUpdate(user._id, { $set: { role: "admin" } }, { new: true })) || user;
}

module.exports = { applyAdminAllowlist };
