const mongoose = require("mongoose");

// Connects to MongoDB. Throws on failure so the caller decides what to do (app.js exits).
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log("MongoDB connected");
};

module.exports = connectDB;
