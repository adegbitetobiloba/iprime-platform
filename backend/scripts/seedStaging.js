// Creates TEST data in the STAGING database only (Account 6, B1).
//
// Safety: it refuses to run unless ALL of these are true, and it checks them BEFORE it connects to anything:
//   - STAGING_SEED=yes
//   - the database name inside MONGO_URI ends with "_staging"  (production's database does not)
//   - NODE_ENV is not "production"  (so it can never run on the Render service itself)
//   - SEED_PASSWORD is at least 12 characters (used for every test account; never printed, never stored in Git)
//
// Run it from a Codespace (Render's free plan has no shell). Values are typed at run time, never committed:
//   cd backend
//   STAGING_SEED=yes SEED_PASSWORD='a long passphrase' MONGO_URI='<staging connection string>' node scripts/seedStaging.js
//
// Safe to run again: every record is found-or-created by a fixed key, and existing records are left alone,
// except that the test accounts' passwords are reset to SEED_PASSWORD.
require("dotenv").config();

const uri = process.env.MONGO_URI || "";
const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^/?#]+)/);
const dbName = m ? decodeURIComponent(m[1]) : "";
const password = process.env.SEED_PASSWORD || "";

function refuse(why) {
  console.error(`Refusing to run: ${why}`);
  process.exit(1);
}
if (process.env.STAGING_SEED !== "yes") refuse("set STAGING_SEED=yes to confirm this is a staging run.");
if (process.env.NODE_ENV === "production") refuse("NODE_ENV is production. Run this from a Codespace, not on the server.");
if (!uri) refuse("MONGO_URI is not set.");
if (!/_staging$/.test(dbName)) refuse(`the database name in MONGO_URI must end with "_staging" (found "${dbName || "none"}").`);
if (password.length < 12) refuse("SEED_PASSWORD must be at least 12 characters.");

const EMAILS = {
  admin: "staging.admin@example.com",
  student1: "staging.student1@example.com",
  student2: "staging.student2@example.com",
  parent: "staging.parent@example.com",
};

// Obviously fake arithmetic questions, written for this seed. Not exam content.
const Q = (text, options, correctKey, topic, explanation) => ({
  text, options: options.map((t, i) => ({ key: "ABCD"[i], text: String(t) })), correctKey, marks: 1, topic, subject: "Mathematics", explanation, explanationSource: "admin_written",
});
const QUESTIONS = [
  Q("7 + 5 = ?", [11, 12, 13, 14], "B", "Arithmetic", "7 + 5 = 12."),
  Q("9 x 6 = ?", [52, 54, 56, 63], "B", "Arithmetic", "9 x 6 = 54."),
  Q("100 - 37 = ?", [63, 67, 73, 53], "A", "Arithmetic", "100 - 37 = 63."),
  Q("48 / 6 = ?", [6, 7, 8, 9], "C", "Arithmetic", "6 x 8 = 48, so 48 / 6 = 8."),
  Q("What comes next: 2, 4, 6, 8, ...?", [9, 10, 11, 12], "B", "Arithmetic", "The numbers go up by 2, so the next one is 10."),
  Q("What is 15% of 200?", [20, 25, 30, 35], "C", "Percentages", "10% of 200 is 20 and 5% is 10, so 15% is 30."),
  Q("A square has sides of 5 cm. What is its perimeter?", ["10 cm", "15 cm", "20 cm", "25 cm"], "C", "Geometry", "4 sides x 5 cm = 20 cm."),
  Q("3 squared + 4 squared = ?", [7, 12, 25, 49], "C", "Arithmetic", "9 + 16 = 25."),
  Q("If x + 9 = 20, what is x?", [9, 10, 11, 12], "C", "Algebra", "x = 20 - 9 = 11."),
  Q("What is half of 3/4?", ["3/8", "1/4", "3/2", "1/2"], "A", "Fractions", "1/2 x 3/4 = 3/8."),
];

(async () => {
  // Required only after the safety checks, so a refused run needs nothing installed.
  const bcrypt = require("bcryptjs");
  const mongoose = require("mongoose");
  const User = require("../models/User");
  const Exam = require("../models/Exam");
  const Subject = require("../models/Subject");
  const Course = require("../models/Course");
  const CourseModule = require("../models/CourseModule");
  const Lesson = require("../models/Lesson");
  const { ensureStudentId } = require("../utils/studentId");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  if (mongoose.connection.name !== dbName) throw new Error(`Connected to "${mongoose.connection.name}", expected "${dbName}". Stopping.`);
  console.log(`Seeding database: ${dbName}`);

  // Accounts: verified and approved, so they can sign in without email or admin review.
  const hash = await bcrypt.hash(password, 10);
  const make = async (email, role, firstName, lastName) => {
    let u = await User.findOneAndUpdate(
      { email },
      { $set: { role, isVerified: true, approval: "approved", password: hash }, $setOnInsert: { firstName, lastName, phone: "08000000000", country: "Nigeria", state: "Lagos" } },
      { upsert: true, new: true }
    );
    if (role === "student") u = await ensureStudentId(u);
    return u;
  };
  const admin = await make(EMAILS.admin, "admin", "Staging", "Admin");
  const s1 = await make(EMAILS.student1, "student", "Staging", "StudentOne");
  const s2 = await make(EMAILS.student2, "student", "Staging", "StudentTwo");
  await make(EMAILS.parent, "parent", "Staging", "Parent");

  // One published practice exam.
  const TITLE = "STAGING Practice Exam (arithmetic)";
  let exam = await Exam.findOne({ title: TITLE });
  if (!exam) {
    exam = await Exam.create({
      title: TITLE, subject: "Mathematics", level: "Test", examType: "Practice test",
      description: "Test data for staging. Not real exam content.",
      instructions: "This is a staging test exam. Answer all 10 questions.",
      durationMinutes: 10, maxAttempts: 10, showAnswersAfter: true, status: "published", questions: QUESTIONS, createdBy: admin._id,
    });
  }

  // One published course with a text lesson (linked to the exam as its practice test) and a link lesson.
  const subject = await Subject.findOneAndUpdate({ slug: "mathematics-staging" }, { $setOnInsert: { name: "Mathematics (staging)", slug: "mathematics-staging", group: "subject", status: "active" } }, { upsert: true, new: true });
  const course = await Course.findOneAndUpdate(
    { slug: "staging-basic-arithmetic" },
    { $setOnInsert: { title: "STAGING Basic Arithmetic", slug: "staging-basic-arithmetic", description: "Test course for staging. Not real teaching content.", subject: subject._id, examTags: ["JAMB"], status: "published", publishedAt: new Date(), createdBy: admin._id } },
    { upsert: true, new: true }
  );
  const mod = await CourseModule.findOneAndUpdate({ course: course._id, title: "Chapter 1" }, { $setOnInsert: { course: course._id, title: "Chapter 1", order: 0, topics: [{ title: "Addition and subtraction" }] } }, { upsert: true, new: true });
  const topicId = mod.topics[0] && mod.topics[0]._id;
  await Lesson.findOneAndUpdate(
    { course: course._id, title: "STAGING Lesson 1: Adding numbers" },
    { $setOnInsert: { course: course._id, module: mod._id, topicId, title: "STAGING Lesson 1: Adding numbers", order: 1, contentType: "text", body: "# Adding numbers\n\nThis is test text for staging.\n\n- 2 + 3 = 5\n- 7 + 5 = 12\n", estimatedMinutes: 3, practice: { exam: exam._id, topic: "Arithmetic" }, status: "published", createdBy: admin._id } },
    { upsert: true, new: true }
  );
  await Lesson.findOneAndUpdate(
    { course: course._id, title: "STAGING Lesson 2: External link" },
    { $setOnInsert: { course: course._id, module: mod._id, topicId, title: "STAGING Lesson 2: External link", order: 2, contentType: "link", externalUrl: "https://example.com/", estimatedMinutes: 1, status: "published", createdBy: admin._id } },
    { upsert: true, new: true }
  );

  console.log("Done. Test accounts (password = the SEED_PASSWORD you typed):");
  for (const [k, v] of Object.entries(EMAILS)) console.log(`  ${k}: ${v}`);
  console.log(`Student IDs: ${s1.studentId}, ${s2.studentId}`);
  console.log(`Exam: "${TITLE}" (10 questions). Course: "STAGING Basic Arithmetic" (2 lessons).`);
  console.log("Not seeded yet: a PDF lesson, a video lesson, a locked-browser exam, a password-protected exam.");
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
