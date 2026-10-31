const mongoose = require("mongoose");
const Enrolment = require("../models/Enrolment");
const Programme = require("../models/Programme");
const { canTransition, generateReference, toMinorUnits } = require("../utils/enrolmentRules");
const { missingForSubmit, buildConsents } = require("../utils/enrolmentSubmit");
const { audit } = require("../utils/audit");

const OPEN = ["draft", "submitted", "under_review", "more_info_required", "approved"];
const EDITABLE = ["draft", "more_info_required"];

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
// Defence in depth: even if route validation changed, only these keys can ever be written by a student.
const STUDENT_FIELDS = ["student", "guardian", "academic", "subjectsRequested", "otherSubject", "studyMode", "session", "technology", "payment", "health", "referral", "mockScore"];
const pick = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => STUDENT_FIELDS.includes(k)));
const isPlain = (v) => Object.prototype.toString.call(v) === "[object Object]";

// { student: { phone: "1" } } -> { "student.phone": "1" } so saving one field never wipes its neighbours.
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (isPlain(v)) flatten(v, `${prefix}${k}.`, out); else out[`${prefix}${k}`] = v;
  }
  return out;
}

// Turns the typed fee into integer kobo. Returns null if the amount is not a valid money value.
function normalisePayment(body) {
  if (!body.payment || !("agreedFee" in body.payment)) return true;
  const { agreedFee, ...rest } = body.payment;
  body.payment = rest;
  if (agreedFee === null || agreedFee === "") { body.payment.agreedFeeMinor = null; return true; }
  const minor = toMinorUnits(agreedFee);
  if (minor === null) return false;
  body.payment.agreedFeeMinor = minor;
  if (!body.payment.currency) body.payment.currency = "NGN"; // NGN is the only supported currency until the owner confirms others
  return true;
}

// What a student may see of their own application. Staff-only office fields are removed.
function studentView(doc) {
  const { _id, __v, office, ...rest } = doc.toObject ? doc.toObject() : doc;
  return { id: String(_id), ...rest };
}

// POST /api/enrolments { programmeId, ...optional fields } : start a draft
exports.create = async (req, res) => {
  try {
    const programmeId = req.body.programmeId;
    const fields = pick(req.body);
    if (!mongoose.isValidObjectId(programmeId)) return res.status(400).json({ error: "Choose a programme." });
    if (!normalisePayment(fields)) return res.status(400).json({ error: "Enter a valid amount." });
    const programme = await Programme.findOne({ _id: programmeId, status: "published" }).select("_id").lean();
    if (!programme) return res.status(404).json({ error: "That programme is not available." });
    const open = await Enrolment.findOne({ userId: req.user.id, programmeId, status: { $in: OPEN } }).select("_id").lean();
    if (open) return res.status(409).json({ error: "You already have an application for this programme.", id: String(open._id) });

    let doc = null;
    for (let i = 0; i < 5 && !doc; i++) {
      try {
        doc = await Enrolment.create({ ...fields, userId: req.user.id, programmeId, reference: generateReference(), status: "draft" });
      } catch (err) {
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.reference) continue; // reference clash: try another
        if (err && err.code === 11000) return res.status(409).json({ error: "You already have an application for this programme." });
        throw err;
      }
    }
    if (!doc) return serverError(res, new Error("Could not generate a unique reference"));
    await audit(req, { entityType: "enrolment", entityId: doc._id, event: "enrolment.draft_created", meta: { reference: doc.reference } });
    res.status(201).json({ enrolment: studentView(doc) });
  } catch (err) { serverError(res, err); }
};

// GET /api/enrolments/mine
exports.mine = async (req, res) => {
  try {
    const items = await Enrolment.find({ userId: req.user.id }).select("-office").sort({ createdAt: -1 }).limit(20).lean();
    res.json({ enrolments: items.map(studentView) });
  } catch (err) { serverError(res, err); }
};

// GET /api/enrolments/:id (own only)
exports.getOne = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const doc = await Enrolment.findOne({ _id: req.params.id, userId: req.user.id }).select("-office").lean();
    if (!doc) return res.status(404).json({ error: "Application not found" });
    res.json({ enrolment: studentView(doc) });
  } catch (err) { serverError(res, err); }
};

// PATCH /api/enrolments/:id : save part of a draft. Only while draft or more_info_required, and only your own.
exports.save = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const body = pick(req.body);
    if (!normalisePayment(body)) return res.status(400).json({ error: "Enter a valid amount." });
    const $set = flatten(body);
    if (!Object.keys($set).length) return res.status(400).json({ error: "Nothing to save." });
    // One atomic step: the status check and the write cannot be separated by a submit or a review.
    const doc = await Enrolment.findOneAndUpdate({ _id: req.params.id, userId: req.user.id, status: { $in: EDITABLE } }, { $set }, { new: true, runValidators: true }).select("-office").lean();
    if (!doc) {
      const exists = await Enrolment.exists({ _id: req.params.id, userId: req.user.id });
      return exists ? res.status(409).json({ error: "This application can no longer be edited." }) : res.status(404).json({ error: "Application not found" });
    }
    res.json({ enrolment: studentView(doc) });
  } catch (err) { serverError(res, err); }
};

// POST /api/enrolments/:id/submit { acknowledgements }
exports.submit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Application not found" });
    const doc = await Enrolment.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!doc) return res.status(404).json({ error: "Application not found" });
    if (!canTransition(doc.status, "submitted")) return res.status(409).json({ error: "This application has already been submitted." });

    const ack = req.body.acknowledgements || {};
    const { problems, minor } = missingForSubmit(doc, ack);
    if (problems.length) return res.status(400).json({ error: problems[0], problems });

    const updated = await Enrolment.findOneAndUpdate(
      { _id: doc._id, userId: req.user.id, status: doc.status }, // a second click or tab loses this race and gets a 409
      { $set: { status: "submitted", submittedAt: new Date() }, $push: { consents: { $each: buildConsents(ack, minor) } } },
      { new: true }
    ).select("-office").lean();
    if (!updated) return res.status(409).json({ error: "This application has already been submitted." });
    await audit(req, { entityType: "enrolment", entityId: doc._id, event: "enrolment.submitted", meta: { reference: doc.reference, from: doc.status, minor } });
    res.json({ enrolment: studentView(updated) });
  } catch (err) { serverError(res, err); }
};

exports._flatten = flatten;
