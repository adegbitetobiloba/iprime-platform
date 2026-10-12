const crypto = require("crypto");
const User = require("../models/User");

// 8 characters from a 31-character alphabet (no 0/O/1/I/L, to avoid look-alikes) = about 850 billion combinations.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 31 characters
const PREFIX = "PET";

const generate = () => {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${PREFIX}-${out}`;
};

// Gives a verified student a permanent ID the first time one is needed. Existing IDs are never changed.
// The database's unique index guarantees no duplicates; on a (very rare) collision we simply try again.
async function ensureStudentId(user) {
  if (!user || user.role !== "student" || !user.isVerified || user.studentId) return user;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await User.findOneAndUpdate(
        { _id: user._id, studentId: { $exists: false } },
        { $set: { studentId: generate() } },
        { new: true }
      );
      return updated || (await User.findById(user._id)); // another request assigned it first
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error("Could not allocate a student ID");
}

module.exports = { ensureStudentId, generate };
