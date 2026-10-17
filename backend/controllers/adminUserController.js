const mongoose = require("mongoose");
const User = require("../models/User");
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const Programme = require("../models/Programme");
const { escapeRegExp, parsePaging } = require("../utils/paging");

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

// Only these fields ever leave the server about a person. No password hash, no Google id.
const LIST_FIELDS = "firstName lastName email phone state role studentId isVerified createdAt alumniStatus alumni";

// GET /api/admin/overview : every number is counted from the database
exports.overview = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [students, parents, alumni, pendingAlumni, verifiedStudents, exams, publishedExams, programmes, attempts, recentAttempts, questionAgg] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "parent" }),
      User.countDocuments({ role: "alumni" }),
      User.countDocuments({ role: "alumni", alumniStatus: "pending" }),
      User.countDocuments({ role: "student", isVerified: true }),
      Exam.countDocuments(),
      Exam.countDocuments({ status: "published" }),
      Programme.countDocuments({ status: "published" }),
      Attempt.countDocuments({ status: "submitted" }),
      Attempt.countDocuments({ status: "submitted", submittedAt: { $gte: since } }),
      Exam.aggregate([{ $project: { n: { $size: { $ifNull: ["$questions", []] } } } }, { $group: { _id: null, total: { $sum: "$n" } } }]),
    ]);
    res.json({
      students, verifiedStudents, parents, alumni, pendingAlumni, exams, publishedExams, publishedProgrammes: programmes,
      questions: questionAgg[0]?.total || 0, submittedAttempts: attempts, attemptsLast7Days: recentAttempts,
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/students?search=&role=&page=&limit=
exports.listStudents = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const role = ["student", "parent", "alumni"].includes(req.query.role) ? req.query.role : "student";
    const filter = { role };
    if (role === "alumni" && ["unverified", "pending", "verified", "rejected"].includes(req.query.status)) filter.alumniStatus = req.query.status;
    const search = String(req.query.search || "").trim().slice(0, 80);
    if (search) {
      const rx = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { studentId: rx }];
    }
    const [total, items] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select(LIST_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({
      students: items.map(({ _id, ...u }) => ({ id: String(_id), ...u })),
      page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/students/:id : one person and their submitted examinations
exports.getStudent = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Student not found" });
    const u = await User.findById(req.params.id).select(`${LIST_FIELDS} otherNames dob country`).lean();
    if (!u || !["student", "parent", "alumni"].includes(u.role)) return res.status(404).json({ error: "Student not found" });
    const attempts = await Attempt.find({ userId: u._id, status: "submitted" }).sort({ submittedAt: -1 }).limit(50).lean();
    const exams = await Exam.find({ _id: { $in: attempts.map((a) => a.examId) } }).select("title subject").lean();
    const byId = new Map(exams.map((e) => [String(e._id), e]));
    const { _id, ...rest } = u;
    res.json({
      student: { id: String(_id), ...rest },
      attempts: attempts.map((a) => ({
        id: String(a._id), examTitle: byId.get(String(a.examId))?.title || "Examination", subject: byId.get(String(a.examId))?.subject,
        submittedAt: a.submittedAt, score: a.score, totalMarks: a.totalMarks, percentage: a.percentage, autoSubmitted: a.autoSubmitted,
      })),
    });
  } catch (err) { serverError(res, err); }
};

// PATCH /api/admin/alumni/:id  { status: "verified" | "rejected" } : staff confirm (or decline) a former student's claim
exports.reviewAlumni = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Account not found" });
    const status = req.body.status;
    if (!["verified", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be verified or rejected." });
    const u = await User.findOneAndUpdate({ _id: req.params.id, role: "alumni" }, { $set: { alumniStatus: status, "alumni.reviewedAt": new Date() } }, { new: true }).select(LIST_FIELDS).lean();
    if (!u) return res.status(404).json({ error: "Alumni account not found" });
    const { _id, ...rest } = u;
    res.json({ alumnus: { id: String(_id), ...rest } });
  } catch (err) { serverError(res, err); }
};
