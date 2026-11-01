require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const cbtRoutes = require("./routes/cbtRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");
const studentRoutes = require("./routes/studentRoutes");
const publicRoutes = require("./routes/publicRoutes");
const libraryRoutes = require("./routes/libraryRoutes");
const adminLibraryRoutes = require("./routes/adminLibraryRoutes");
const { startSweeper } = require("./utils/attemptSweeper");

const isProd = process.env.NODE_ENV === "production";
const app = express();

app.set("trust proxy", 1); // behind Render's proxy: needed for correct client IPs (rate limiting)
app.use(helmet());

// CORS_ORIGINS is a comma-separated allow-list. In production it is mandatory (see start()).
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : !isProd }));

app.use(express.json({ limit: "300kb" })); // MUST come before the routes (large enough for pasted question lists)
if (process.env.NODE_ENV !== "test") app.use(morgan("tiny"));

app.get("/", (req, res) => res.send("iPrime API"));
app.get("/health", (req, res) => res.json({ status: "ok", db: mongoose.connection.readyState === 1, commit: (process.env.RENDER_GIT_COMMIT || "").slice(0, 7) || undefined }));

app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin/library", adminLibraryRoutes); // before /api/admin so the longer path matches first
app.use("/api/library", libraryRoutes);            // before /api (CBT router)
app.use("/api/admin/analytics", adminAnalyticsRoutes); // before /api/admin so the longer path is matched first
app.use("/api/admin", adminRoutes);
app.use("/api/student/analytics", analyticsRoutes); // longer path first
app.use("/api/student", studentRoutes);
// both student mounts must stay before the "/api" CBT router below, which guards all of /api
app.use("/api", cbtRoutes);
app.use("/api/enrolments", require("./routes/enrolmentRoutes"));

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

async function start() {
  const problems = [];
  if (!process.env.MONGO_URI) problems.push("MONGO_URI is not set");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) problems.push("JWT_SECRET must be set and at least 32 characters");
  if (isProd && !allowedOrigins.length) problems.push("CORS_ORIGINS must be set in production");
  if (problems.length) {
    console.error("Configuration error:\n - " + problems.join("\n - "));
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`iPrime API listening on ${PORT}`));
  startSweeper(); // closes expired exam attempts even if the student never returns (EXAM_SWEEP_SECONDS, 0 = off)
  process.on("SIGTERM", () => server.close(() => mongoose.connection.close().finally(() => process.exit(0))));
}

// Only start listening when run directly (node app.js), so tests can import `app`.
if (require.main === module) start();

module.exports = app;
