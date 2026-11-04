const StudentAccess = require("../models/StudentAccess");
const { formUnlocked } = require("./accessRules");

// DB helpers used by the enrolment form gate.
const getAccess = (userId) => StudentAccess.findOne({ userId }).lean();
const canOpenEnrolmentForm = async (userId) => formUnlocked(await getAccess(userId));
const LOCKED = { error: "Your payment has not been confirmed yet. The office will unlock the student registration form for you once your payment is confirmed.", code: "ENROLMENT_LOCKED" };

module.exports = { getAccess, canOpenEnrolmentForm, LOCKED };
