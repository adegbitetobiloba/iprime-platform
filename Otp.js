const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  attempts: { type: Number, default: 0 }, // wrong guesses so far
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 300 }, // MongoDB deletes the code 5 minutes after creation
  },
});

module.exports = mongoose.model("Otp", otpSchema);
