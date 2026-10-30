const mongoose = require("mongoose");
const Enrolment = require("../models/Enrolment");
const User = require("../models/User");
const { canTransition, ENROLMENT_STATUSES, toMinorUnits } = require("../utils/enrolmentRules");
const { parsePaging } = require("../utils/paging");
const { audit } = require("../utils/audit");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const OFFICE_EDITABLE = ["submitted", "under_review", "more_info_required"];
// The list shows only what a reviewer needs to pick a case. Medical, guardian and address details stay out of it.
const LIST_FIELDS = "reference status userId programmeId studyMode session submittedAt createdAt subjectsRequested subjectsRegistered";

// GET /api/admin/enrolments?status=&page=&limit=   (drafts are never listed: they are not applications yet)
exports.list = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = { status: { $ne: "draft" } };
    if (ENROLMENT_STATUSES.includes(req.query.status) && req.query.status !== "draft") filter.status = req.query.status;
    const [total, items] = await Promise.all([
      Enrolment.countDocuments(filter),
      Enrolment.find(filter).select(LIST_FIELDS).sort({ submittedAt: 1 }).skip(skip).limit(limit).lean(), // oldest first: first come, first reviewed
    ]);
    const people = await User.find({ _id: { $in: items.map((i) => i.userId) } }).select("firstName lastName email studentId").lean();
    const byId = new Map(people.map((p) => [String(p._id), p]));
    res.json({
      enrolments: items.map(({ _id, userId, ...e }) => ({ id: String(_id), ...e, applicant: byId.get(String(userId)) ? { firstName: byId.get(String(userId)).firstName, lastName: byId.get(String(userId)).lastName, studentId: byId.get(String(userId)).studentId } : null })),
      page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { serverError(res, err); }
};

// GET /api/admin/enrolments/:id : the full application. Viewing sensitive details is itself audited.
exports.get = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const doc = await Enrolment.findById(req.params.id).lean();
    if (!doc || doc.status === "draft") return res.status(404).json({ error: "Application not found" });
    const person = await User.findById(doc.userId).select("firstName lastName email studentId isVerified approval").lean();
    await audit(req, { entityType: "enrolment", entityId: doc._id, event: "enrolment.viewed", meta: { reference: doc.reference } });
    const { _id, __v, ...rest } = doc;
    res.json({ enrolment: { id: String(_id), ...rest }, applicant: person ? { firstName: person.firstName, lastName: person.lastName, email: person.email, studentId: person.studentId, isVerified: person.isVerified, approval: person.approval } : null });
  } catch (err) { serverError(res, err); }
};

// PATCH /api/admin/enrolments/:id/office { subjectsRegistered?, feeApproved?, currency? }
// Registrar-only fields. Kept apart from what the student asked for and typed.
exports.updateOffice = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const doc = await Enrolment.findById(req.params.id).lean();
    if (!doc || doc.status === "draft") return res.status(404).json({ error: "Application not found" });
    if (!OFFICE_EDITABLE.includes(doc.status)) return res.status(409).json({ error: "This application is closed and cannot be changed." });

    const { subjectsRegistered, feeApproved, currency } = req.body;
    const $set = { "office.registeredBy": req.user.id, "office.registeredAt": new Date() };
    if (subjectsRegistered) $set.subjectsRegistered = subjectsRegistered;
    if (feeApproved !== undefined) {
      const minor = toMinorUnits(feeApproved);
      if (minor === null || minor <= 0) return res.status(400).json({ error: "Enter a valid fee amount greater than zero." });
      $set["office.feeApprovedMinor"] = minor;
      $set["office.currency"] = currency || "NGN";
    }
    const updated = await Enrolment.findOneAndUpdate({ _id: doc._id, status: { $in: OFFICE_EDITABLE } }, { $set }, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(409).json({ error: "This application changed while you were editing. Reload and try again." });
    // Before and after are recorded so a changed fee or subject list is traceable. Neither is sensitive personal data.
    await audit(req, { entityType: "enrolment", entityId: doc._id, event: "enrolment.office_updated", meta: { reference: doc.reference, subjectsBefore: doc.subjectsRegistered, subjectsAfter: updated.subjectsRegistered, feeBeforeMinor: doc.office && doc.office.feeApprovedMinor, feeAfterMinor: updated.office && updated.office.feeApprovedMinor } });
    const { _id, __v, ...rest } = updated;
    res.json({ enrolment: { id: String(_id), ...rest } });
  } catch (err) { serverError(res, err); }
};

// Builds a handler that moves an application to `to`. The status check and the write are one atomic step.
const review = (to, { noteRequired = false } = {}) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const doc = await Enrolment.findById(req.params.id).lean();
    if (!doc || doc.status === "draft") return res.status(404).json({ error: "Application not found" });
    if (!canTransition(doc.status, to)) return res.status(409).json({ error: `An application that is ${doc.status.replace(/_/g, " ")} cannot be moved to ${to.replace(/_/g, " ")}.` });
    const note = String((req.body && req.body.note) || "").trim();
    if (noteRequired && !note) return res.status(400).json({ error: "A reason is required." });
    if (to === "approved" && !(doc.subjectsRegistered || []).length) return res.status(400).json({ error: "Confirm the registered subjects before approving." });

    const updated = await Enrolment.findOneAndUpdate(
      { _id: doc._id, status: doc.status },
      { $set: { status: to }, $push: { reviews: { by: req.user.id, at: new Date(), action: to, note: note || undefined } } },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: "This application was just changed by someone else. Reload and try again." });
    await audit(req, { entityType: "enrolment", entityId: doc._id, event: `enrolment.${to}`, meta: { reference: doc.reference, from: doc.status, hasNote: !!note } });
    const { _id, __v, ...rest } = updated;
    res.json({ enrolment: { id: String(_id), ...rest } });
  } catch (err) { serverError(res, err); }
};

exports.startReview = review("under_review");
exports.requestInfo = review("more_info_required", { noteRequired: true });
exports.approve = review("approved");
exports.reject = review("rejected", { noteRequired: true });
