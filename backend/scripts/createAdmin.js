// Creates (or promotes) an administrator. Credentials come from environment variables at run time,
// so nothing sensitive is stored in the repository or shell history:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' npm run create-admin
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!process.env.MONGO_URI || !email || password.length < 12) {
    console.error("Set MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hashed = await bcrypt.hash(password, 10);
  await User.findOneAndUpdate(
    { email },
    {
      $set: { role: "admin", isVerified: true, password: hashed },
      $setOnInsert: {
        firstName: process.env.ADMIN_FIRST_NAME || "Admin",
        lastName: process.env.ADMIN_LAST_NAME || "User",
        phone: process.env.ADMIN_PHONE || "00000000000",
        country: "Nigeria",
        state: process.env.ADMIN_STATE || "Lagos",
      },
    },
    { upsert: true }
  );
  console.log(`Administrator ready: ${email}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
