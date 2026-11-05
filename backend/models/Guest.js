const mongoose = require("mongoose");

// Someone who opened an examination through a share link without an iPrime account. They give a name (always) and,
// if the link asks for it, an email address or phone number. Their id is used as the attempt's userId, so they go
// through exactly the same exam engine as a student. Not a User: it cannot log in anywhere else.
const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    contact: { type: String, trim: true, maxlength: 120 },
    contactKey: { type: String, trim: true, maxlength: 120 }, // lower-cased contact, used to recognise the same person returning
    shareId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamShare", required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
guestSchema.index({ shareId: 1, contactKey: 1 }, { unique: true, partialFilterExpression: { contactKey: { $type: "string" } } });

module.exports = mongoose.model("Guest", guestSchema);
