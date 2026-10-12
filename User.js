const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  otherNames: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  dob: { type: Date },
  country: { type: String, required: true, default: "Nigeria" },
  state: { type: String, required: true },
  role: { type: String, enum: ["student", "parent", "teacher", "admin"], default: "student" },
  // Public student identifier, e.g. PET-7K4M9Q2X. Assigned by the server only; never edited by users.
  studentId: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
