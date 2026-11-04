const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const StudentAccess = require("../models/StudentAccess");
const Enrolment = require("../models/Enrolment");
const Attendance = require("../models/Attendance");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const MessageFile = require("../models/MessageFile");
const Otp = require("../models/Otp");
const { parsePaging, escapeRegExp } = require("../utils/paging");
const { audit } = require("../utils/audit");
const { toMinorUnits } = require("../utils/enrolmentRules");
const R = require("../utils/accessRules");
const { notifyPaymentConfirmed } = require("../utils/accessNotify");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
const notFound = (res) => res.status(404).json({ error: "Person not found" });
const load = (id) => (mongoose.isValidObjectId(id) ? User.findById(id).select("firstName lastName email phone state dob role studentId isVerified approval createdAt").lean() : null);

const payView = (p) => ({ id: String(p._id), amountMinor: p.amountMinor, currency: p.currency, method: p.method, reference: p.reference, receivedOn: p.receivedOn, note: p.note, confirmedAt: p.confirmedAt, voided: !!p.voidedAt, voidReason: p.voidedAt ? p.voidReason : undefined });

// GET /api/admin/people?search=&role=&page=
exports.list = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = { email: { $not: /@deleted\.invalid$/ } }; // deleted accounts never appear
    if (["student", "parent", "alumni", "teacher", "admin"].includes(req.query.role)) filter.role = req.query.role;
    const q = String(req.query.search || "").trim();
    if (q) { const rx = new RegExp(escapeRegExp(q), "i"); filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { studentId: rx }]; }
    const [total, rows] = await Promise.all([User.countDocuments(filter), User.find(filter).select("firstName lastName email role studentId isVerified approval createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit).lean()]);
    res.json({ people: rows.map((u) => ({ id: String(u._id), name: fullName(u), email: u.email, role: u.role, studentId: u.studentId, isVerified: u.isVerified, approval: u.approval || "approved", joined: u.createdAt })), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/people/:id : everything the office needs about one person, on one screen
exports.record = async (req, res) => {
  try {
    const u = await load(req.params.id);
    if (!u || R.isDeleted(u)) return notFound(res);
    const since = R.lagosDay(new Date(Date.now() - 29 * 86400000));
    const [access, enrolment, recent, conv] = await Promise.all([
      StudentAccess.findOne({ userId: u._id }).lean(),
      Enrolment.findOne({ userId: u._id, status: { $ne: "draft" } }).sort({ createdAt: -1 }).select("reference status submittedAt").lean(),
      Attendance.find({ studentId: u._id, active: true }).sort({ checkedInAt: -1 }).limit(30).lean(),
      Conversation.findOne({ studentId: u._id }).select("blocked adminUnread").lean(),
    ]);
    const days = new Set(recent.filter((a) => a.day >= since).map((a) => a.day));
    res.json({
      person: { id: String(u._id), name: fullName(u), email: u.email, phone: u.phone, state: u.state, role: u.role, studentId: u.studentId, isVerified: u.isVerified, approval: u.approval || "approved", joined: u.createdAt },
      isStudent: u.role === "student",
      access: {
        paymentStatus: R.paymentStatus(access), totalConfirmedMinor: R.totalConfirmedMinor(access), payments: ((access && access.payments) || []).map(payView),
        features: { enrolmentForm: R.formUnlocked(access) }, unlockNote: access && access.unlockNote && access.unlockNote.reason ? access.unlockNote.reason : undefined,
        verification: { status: (access && access.verification && access.verification.status) || "unverified", at: access && access.verification && access.verification.at, note: access && access.verification && access.verification.note },
      },
      enrolment: enrolment ? { reference: enrolment.reference, status: enrolment.status, submittedAt: enrolment.submittedAt } : null,
      attendance: { daysPresentLast30: days.size, recent: recent.slice(0, 8).map((a) => ({ id: String(a._id), day: a.day, session: a.session, status: a.status, override: a.override })) },
      messaging: { blocked: !!(conv && conv.blocked && conv.blocked.at), reason: conv && conv.blocked && conv.blocked.reason, unread: (conv && conv.adminUnread) || 0 },
      guardianRequired: u.dob ? require("../utils/enrolmentRules").requiresGuardianConsent(u.dob) : null,
    });
  } catch (err) { serverError(res, err); }
};

async function studentOnly(req, res) {
  const u = await load(req.params.id);
  if (!u || R.isDeleted(u)) { notFound(res); return null; }
  if (u.role !== "student") { res.status(400).json({ error: "This only applies to student accounts." }); return null; }
  return u;
}

// PATCH /api/admin/people/:id/features { enrolmentForm, reason? } : the administrator chooses what this person can open
exports.setFeatures = async (req, res) => {
  try {
    const u = await studentOnly(req, res); if (!u) return;
    const want = req.body.enrolmentForm === true;
    const access = await StudentAccess.findOne({ userId: u._id }).lean();
    const withoutPayment = want && R.paymentStatus(access) !== "confirmed";
    const why = String(req.body.reason || "").trim();
    if (withoutPayment && why.length < 5) return res.status(400).json({ error: "No payment is confirmed for this student. Give a reason to open the form anyway.", code: "REASON_REQUIRED" });
    const $set = { "features.enrolmentForm": want };
    if (withoutPayment) $set.unlockNote = { reason: why, by: req.user.id, at: new Date() };
    await StudentAccess.findOneAndUpdate({ userId: u._id }, { $set, $setOnInsert: { userId: u._id } }, { upsert: true, new: true });
    await audit(req, { entityType: "person", entityId: u._id, event: "access.features_changed", meta: { enrolmentForm: want, withoutPayment } });
    res.json({ features: { enrolmentForm: want } });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/people/:id/payments { amount, method, reference?, receivedOn?, note? } : staff confirm they received a payment.
// Manual only. This never trusts a screenshot or a student's claim; staff check the bank statement or receipt first.
exports.addPayment = async (req, res) => {
  try {
    const u = await studentOnly(req, res); if (!u) return;
    const minor = toMinorUnits(req.body.amount);
    if (minor === null || minor <= 0) return res.status(400).json({ error: "Enter a valid amount greater than zero (for example 18000)." });
    const reference = String(req.body.reference || "").trim();
    if (reference) { // the same transfer cannot be counted twice, for anyone
      const dup = await StudentAccess.findOne({ payments: { $elemMatch: { method: req.body.method, reference, voidedAt: null } } }).select("userId").lean();
      if (dup) return res.status(409).json({ error: "A payment with that method and reference has already been recorded.", code: "DUPLICATE_PAYMENT" });
    }
    const entry = { amountMinor: minor, currency: "NGN", method: req.body.method, reference: reference || undefined, receivedOn: req.body.receivedOn ? new Date(req.body.receivedOn) : undefined, note: req.body.note || undefined, confirmedBy: req.user.id, confirmedAt: new Date() };
    const access = await StudentAccess.findOneAndUpdate({ userId: u._id }, { $push: { payments: entry }, $set: { "features.enrolmentForm": true }, $setOnInsert: { userId: u._id } }, { upsert: true, new: true }).lean();
    await audit(req, { entityType: "person", entityId: u._id, event: "payment.confirmed", meta: { amountMinor: minor, method: req.body.method, hasReference: !!reference } });
    notifyPaymentConfirmed(u); // fire and forget
    res.status(201).json({ paymentStatus: R.paymentStatus(access), payments: access.payments.map(payView), features: { enrolmentForm: true } });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/people/:id/payments/:entryId/void { reason }
exports.voidPayment = async (req, res) => {
  try {
    const u = await studentOnly(req, res); if (!u) return;
    if (!mongoose.isValidObjectId(req.params.entryId)) return res.status(404).json({ error: "Payment not found" });
    const hit = await StudentAccess.findOneAndUpdate(
      { userId: u._id, "payments._id": req.params.entryId, "payments.voidedAt": null },
      { $set: { "payments.$.voidedAt": new Date(), "payments.$.voidedBy": req.user.id, "payments.$.voidReason": req.body.reason } }, { new: true }).lean();
    if (!hit) return res.status(404).json({ error: "That payment was not found, or it is already voided." });
    let closed = false;
    if (R.paymentStatus(hit) === "awaiting") { await StudentAccess.updateOne({ userId: u._id }, { $set: { "features.enrolmentForm": false } }); closed = true; } // no payment left: the form closes again
    await audit(req, { entityType: "person", entityId: u._id, event: "payment.voided", meta: { formClosed: closed } });
    res.json({ paymentStatus: closed ? "awaiting" : "confirmed", formClosed: closed, payments: hit.payments.map(payView) });
  } catch (err) { serverError(res, err); }
};

// POST /api/admin/people/:id/verification { action: verify|revoke, identityDocumentSeen, guardianContacted, note }
exports.setVerification = async (req, res) => {
  try {
    const u = await studentOnly(req, res); if (!u) return;
    const problem = R.verificationProblem(u, req.body);
    if (problem) return res.status(400).json({ error: problem });
    const access = await StudentAccess.findOne({ userId: u._id }).lean();
    const now = R.isVerified(access);
    if (req.body.action === "verify" && now) return res.status(409).json({ error: "This student is already verified." });
    if (req.body.action === "revoke" && !now) return res.status(409).json({ error: "This student is not verified." });
    const v = req.body.action === "verify"
      ? { status: "verified", at: new Date(), by: req.user.id, note: req.body.note || undefined, checks: { identityDocumentSeen: true, guardianContacted: req.body.guardianContacted === true } }
      : { status: "revoked", at: new Date(), by: req.user.id, note: req.body.note, checks: {} };
    await StudentAccess.findOneAndUpdate({ userId: u._id }, { $set: { verification: v }, $setOnInsert: { userId: u._id } }, { upsert: true, new: true });
    await audit(req, { entityType: "person", entityId: u._id, event: req.body.action === "verify" ? "verification.verified" : "verification.revoked", meta: { guardianContacted: req.body.guardianContacted === true } });
    res.json({ verification: { status: v.status, at: v.at } });
  } catch (err) { serverError(res, err); }
};

// DELETE /api/admin/people/:id { confirm, reason } : permanent. The person is signed out and loses their identity; their messages,
// enrolment form, payments record and check-ins are erased. Exam results stay, but no longer link to a named person.
exports.remove = async (req, res) => {
  try {
    const u = await load(req.params.id);
    if (!u) return notFound(res);
    if (u.role === "admin") return res.status(403).json({ error: "Administrator accounts cannot be deleted here." });
    if (String(u._id) === String(req.user.id)) return res.status(403).json({ error: "You cannot delete your own account." });
    const alreadyAnonymised = R.isDeleted(u); // a previous attempt may have stopped part-way: let the cleanup finish
    if (!alreadyAnonymised && !R.confirmMatches(u, req.body.confirm)) return res.status(400).json({ error: u.role === "student" && u.studentId ? "Type the student's ID exactly to confirm." : "Type the person's email exactly to confirm.", code: "CONFIRM_MISMATCH" });

    const oldEmail = u.email;
    const convs = await Conversation.find({ studentId: u._id }).select("_id").lean();
    const convIds = convs.map((c) => c._id);
    if (!alreadyAnonymised) {
      // 1) Close the account first so nothing can sign in while the clean-up runs. The password becomes a random value nobody knows.
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      await User.updateOne({ _id: u._id }, {
        $set: { firstName: "Deleted", lastName: "Account", email: `deleted-${u._id}@${R.DELETED_DOMAIN}`, password: unusable, isVerified: false, approval: "rejected", approvalReview: { by: req.user.id, at: new Date(), note: "Account deleted by an administrator" }, alumniStatus: "none" },
        $unset: { otherNames: 1, phone: 1, dob: 1, state: 1, googleId: 1, studentId: 1, alumni: 1 },
      });
    }
    // 2) Erase what this system holds about them.
    const counts = {};
    counts.files = (await MessageFile.deleteMany({ conversationId: { $in: convIds } })).deletedCount || 0;
    counts.messages = (await Message.deleteMany({ conversationId: { $in: convIds } })).deletedCount || 0;
    counts.conversations = (await Conversation.deleteMany({ studentId: u._id })).deletedCount || 0;
    counts.enrolments = (await Enrolment.deleteMany({ userId: u._id })).deletedCount || 0;
    counts.access = (await StudentAccess.deleteMany({ userId: u._id })).deletedCount || 0;
    counts.checkins = (await Attendance.deleteMany({ studentId: u._id })).deletedCount || 0;
    if (!alreadyAnonymised) await Otp.deleteMany({ email: oldEmail });
    // The audit entry names no one: only the id, the role and the reason.
    await audit(req, { entityType: "person", entityId: u._id, event: "account.deleted", meta: { role: u.role, reason: req.body.reason, resumed: alreadyAnonymised, erased: counts } });
    res.json({ deleted: true, erased: counts });
  } catch (err) { serverError(res, err); }
};
