const mongoose = require("mongoose");
const User = require("../models/User");
const StudentAccess = require("../models/StudentAccess");
const Attendance = require("../models/Attendance");
const { escapeRegExp } = require("../utils/paging");
const { audit } = require("../utils/audit");
const R = require("../utils/accessRules");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(" ");
const FIELDS = "firstName lastName studentId approval dob";

const card = (u, access, today) => {
  const el = R.checkInEligibility(u, access);
  return { id: String(u._id), name: fullName(u), studentId: u.studentId, approved: !u.approval || u.approval === "approved", verified: R.isVerified(access), paymentConfirmed: R.paymentStatus(access) === "confirmed", eligible: el.eligible, reasons: el.reasons, checkedInToday: today.filter((a) => String(a.studentId) === String(u._id)).map((a) => ({ id: String(a._id), session: a.session, status: a.status, at: a.checkedInAt })) };
};

// GET /api/admin/checkin/search?q= : find a student by name or Student ID (a barcode scanner that "types" the ID works too)
exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ students: [] });
    const rx = new RegExp(escapeRegExp(q), "i");
    const users = await User.find({ role: "student", email: { $not: /@deleted\.invalid$/ }, $or: [{ firstName: rx }, { lastName: rx }, { studentId: rx }] }).select(FIELDS).limit(8).lean();
    const ids = users.map((u) => u._id);
    const [accesses, today] = await Promise.all([StudentAccess.find({ userId: { $in: ids } }).lean(), Attendance.find({ studentId: { $in: ids }, day: R.lagosDay(), active: true }).lean()]);
    const by = new Map(accesses.map((a) => [String(a.userId), a]));
    res.json({ day: R.lagosDay(), suggestedSession: R.sessionFor(), students: users.map((u) => card(u, by.get(String(u._id)), today)) });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/checkin/students/:id { session?, status?, note?, overrideReason? }
exports.checkIn = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Student not found" });
    const u = await User.findOne({ _id: req.params.id, role: "student" }).select(FIELDS).lean();
    if (!u) return res.status(404).json({ error: "Student not found" });
    const access = await StudentAccess.findOne({ userId: u._id }).lean();
    const el = R.checkInEligibility(u, access);
    const why = String(req.body.overrideReason || "").trim();
    if (!el.eligible && why.length < 5) return res.status(409).json({ error: "This student cannot be checked in normally.", code: "NOT_ELIGIBLE", reasons: el.reasons, errors: el.reasons }); // "errors" is what the shared api() helper passes to the page

    const day = R.lagosDay();
    const session = req.body.session || R.sessionFor();
    const dup = await Attendance.findOne({ studentId: u._id, day, session, active: true }).select("checkedInAt").lean();
    if (dup) return res.status(409).json({ error: `Already checked in for this ${session} session.`, code: "ALREADY_CHECKED_IN", at: dup.checkedInAt });

    const me = await User.findById(req.user.id).select("firstName").lean();
    let row;
    try {
      row = await Attendance.create({ studentId: u._id, day, session, status: req.body.status || "present", checkedInAt: new Date(), checkedInBy: req.user.id, checkedInByName: me ? me.firstName : undefined, note: req.body.note || undefined, override: !el.eligible, overrideReason: !el.eligible ? why : undefined });
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ error: `Already checked in for this ${session} session.`, code: "ALREADY_CHECKED_IN" }); // two staff at the same moment
      throw err;
    }
    await audit(req, { entityType: "person", entityId: u._id, event: "attendance.checked_in", meta: { day, session, override: !el.eligible } });
    res.status(201).json({ checkIn: { id: String(row._id), day, session, status: row.status, at: row.checkedInAt, override: !el.eligible }, student: { id: String(u._id), name: fullName(u), studentId: u.studentId } });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/checkin/today?day=YYYY-MM-DD : the register for a day
exports.register = async (req, res) => {
  try {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.day || "")) ? req.query.day : R.lagosDay();
    const rows = await Attendance.find({ day, active: true }).sort({ checkedInAt: -1 }).limit(300).lean();
    const people = await User.find({ _id: { $in: rows.map((r) => r.studentId) } }).select("firstName lastName studentId").lean();
    const by = new Map(people.map((p) => [String(p._id), p]));
    const counts = { morning: 0, afternoon: 0, evening: 0 };
    rows.forEach((r) => { counts[r.session] += 1; });
    res.json({ day, counts, total: rows.length, entries: rows.map((r) => { const p = by.get(String(r.studentId)); return { id: String(r._id), studentId: String(r.studentId), name: p ? fullName(p) : "Unknown", studentCode: p && p.studentId, session: r.session, status: r.status, at: r.checkedInAt, by: r.checkedInByName, override: r.override }; }) });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/checkin/:id/void { reason } : a mistaken check-in is voided with a reason, never deleted
exports.voidCheckIn = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Check-in not found" });
    const hit = await Attendance.findOneAndUpdate({ _id: req.params.id, active: true }, { $set: { active: false, voidedAt: new Date(), voidedBy: req.user.id, voidReason: req.body.reason } }, { new: true }).lean();
    if (!hit) return res.status(404).json({ error: "That check-in was not found, or it is already voided." });
    await audit(req, { entityType: "person", entityId: hit.studentId, event: "attendance.voided", meta: { day: hit.day, session: hit.session } });
    res.json({ voided: true });
  } catch (err) { serverError(res, err); }
};
