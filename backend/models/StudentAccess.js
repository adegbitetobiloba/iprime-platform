const mongoose = require("mongoose");

// One record per student: what the office has confirmed (payment, identity) and which website features are switched on for them.
// Payments are recorded by staff only (manual confirmation; no card or gateway data is ever stored here).
const paymentEntry = new mongoose.Schema({
  amountMinor: { type: Number, required: true, min: 1 }, // integer kobo, never a float
  currency: { type: String, enum: ["NGN"], default: "NGN" },
  method: { type: String, enum: ["bank_transfer", "cash", "pos", "other"], required: true },
  reference: { type: String, trim: true, maxlength: 80 },
  receivedOn: Date,
  note: { type: String, trim: true, maxlength: 300 },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  confirmedAt: { type: Date, default: Date.now },
  voidedAt: Date, voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, voidReason: { type: String, maxlength: 300 }, // never deleted: voided with a reason
});

const accessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    payments: { type: [paymentEntry], default: [] },
    // Per-person switches chosen by an administrator. Only enrolmentForm is enforced today.
    features: { enrolmentForm: Boolean },
    unlockNote: { reason: { type: String, maxlength: 300 }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: Date }, // why the form was opened without a payment
    verification: {
      status: { type: String, enum: ["unverified", "verified", "revoked"], default: "unverified" },
      at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, note: { type: String, maxlength: 300 },
      checks: { identityDocumentSeen: Boolean, guardianContacted: Boolean },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentAccess", accessSchema);
