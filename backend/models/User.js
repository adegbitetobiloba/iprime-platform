const mongoose = require("mongoose");

// Accounts created with Google have no password, phone or state until the user adds them.
const unlessGoogle = function () { return !this.googleId; };

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: unlessGoogle, trim: true },
  otherNames: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: unlessGoogle },
  dob: { type: Date },
  country: { type: String, required: true, default: "Nigeria" },
  state: { type: String, required: unlessGoogle },
  role: { type: String, enum: ["student", "parent", "alumni", "teacher", "admin"], default: "student" },
  // Alumni: what they say about their time with the institution, and whether staff have confirmed it.
  // "none" for everyone who is not alumni. Claiming to be alumni gives NO access to student records.
  alumniStatus: { type: String, enum: ["none", "unverified", "pending", "verified", "rejected"], default: "none" },
  alumni: {
    graduationYear: { type: Number, min: 1950, max: 2100 },
    lastClass: { type: String, trim: true, maxlength: 60 },
    note: { type: String, trim: true, maxlength: 300 },
    reviewedAt: { type: Date },
  },
  // Public student identifier, e.g. PET-7K4M9Q2X. Assigned by the server only; never edited by users.
  studentId: { type: String, unique: true, sparse: true },
  password: { type: String, required: unlessGoogle },
  googleId: { type: String, unique: true, sparse: true }, // Google's stable id for the account (never shown to users)
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
