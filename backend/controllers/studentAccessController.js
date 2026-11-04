const StudentAccess = require("../models/StudentAccess");
const Enrolment = require("../models/Enrolment");
const { read: readSettings } = require("./adminSettingsController");
const R = require("../utils/accessRules");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };

// GET /api/enrolments/info : what a student sees before the form: the notice, their payment status, and whether the form is open
exports.info = async (req, res) => {
  try {
    const [settings, access, enrolment] = await Promise.all([
      readSettings(),
      StudentAccess.findOne({ userId: req.user.id }).lean(),
      Enrolment.findOne({ userId: req.user.id }).sort({ createdAt: -1 }).select("reference status").lean(),
    ]);
    res.json({
      notice: settings.notice, paymentInstructions: settings.paymentInstructions,
      payment: { status: R.paymentStatus(access) }, // only "awaiting" or "confirmed": amounts and references stay with the office
      form: { unlocked: R.formUnlocked(access) },
      verification: { status: (access && access.verification && access.verification.status) || "unverified" },
      enrolment: enrolment ? { id: String(enrolment._id), reference: enrolment.reference, status: enrolment.status } : null,
    });
  } catch (err) { serverError(res, err); }
};
