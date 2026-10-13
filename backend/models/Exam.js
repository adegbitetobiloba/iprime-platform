const mongoose = require("mongoose");
const { OPTION_KEYS } = require("../utils/cbt");

const optionSchema = new mongoose.Schema(
  { key: { type: String, enum: OPTION_KEYS, required: true }, text: { type: String, required: true, trim: true, maxlength: 1000 } },
  { _id: false }
);

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  options: { type: [optionSchema], validate: (v) => v.length >= 2 && v.length <= 5 },
  correctKey: { type: String, enum: OPTION_KEYS, required: true }, // never sent to students while the exam is running
  marks: { type: Number, default: 1, min: 0.5, max: 100 },
  topic: { type: String, trim: true, maxlength: 120 },
  explanation: { type: String, trim: true, maxlength: 2000 },
});

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    level: { type: String, trim: true, maxlength: 60 },     // class or level, e.g. "SS 3" (free text, set by the institution)
    examType: { type: String, trim: true, maxlength: 60 },  // e.g. "Practice test", "Termly test" (free text)
    instructions: { type: String, trim: true, maxlength: 3000 },
    durationMinutes: { type: Number, required: true, min: 1, max: 360 },
    maxAttempts: { type: Number, default: 1, min: 1, max: 20 },
    showAnswersAfter: { type: Boolean, default: false }, // may students review correct answers after submitting?
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
