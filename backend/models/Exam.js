const mongoose = require("mongoose");
const { OPTION_KEYS } = require("../utils/cbt");

const optionSchema = new mongoose.Schema(
  { key: { type: String, enum: OPTION_KEYS, required: true }, text: { type: String, required: true, trim: true, maxlength: 1000 }, html: { type: String, maxlength: 6000 } },
  { _id: false }
);

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  options: { type: [optionSchema], validate: (v) => v.length >= 2 && v.length <= 6 },
  correctKey: { type: String, enum: OPTION_KEYS, required: true }, // never sent to students while the exam is running
  marks: { type: Number, default: 1, min: 0.5, max: 100 },
  topic: { type: String, trim: true, maxlength: 120 },
  subject: { type: String, trim: true, maxlength: 80 },        // the question bank subject it came from (used to draw evenly across subjects)
  difficulty: { type: String, enum: ["easy", "medium", "hard"] }, // copied from the bank when known
  explanation: { type: String, trim: true, maxlength: 4000 },
  // Where the explanation came from, shown to students at result review: the document, or an administrator.
  textHtml: { type: String, maxlength: 20000 },        // formatted version of text (sanitised): underlining, paragraphs
  explanationHtml: { type: String, maxlength: 20000 },
  explanationSource: { type: String, enum: ["source", "admin_written"] },
  // Set when the question was copied from the question bank. The exam keeps its OWN snapshot, so later bank edits never change it silently.
  bankId: { type: mongoose.Schema.Types.ObjectId, index: true },
  bankVersion: { type: Number },
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
    shuffleQuestions: { type: Boolean, default: false }, // each student gets their own question order
    // Question pool: when set, the exam's questions are a pool and each student is given their own draw of this many.
    questionsPerStudent: { type: Number, min: 1, max: 500 },
    drawSpread: { type: Boolean, default: true },         // hand out the least-used questions first, so students get completely different papers while the pool lasts
    drawBalance: { type: Boolean, default: true },        // spread each student's draw evenly across topics (or subjects)
    drawMixDifficulty: { type: Boolean, default: false }, // give each student the same easy/medium/hard mix (only for rated questions)
    shuffleOptions: { type: Boolean, default: false },   // each student gets their own option order (questions that refer to other options are never shuffled)
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
