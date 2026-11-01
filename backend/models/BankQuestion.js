const mongoose = require("mongoose");
const { OPTION_KEYS } = require("../utils/cbt");

const optionSchema = new mongoose.Schema({ key: { type: String, enum: OPTION_KEYS, required: true }, text: { type: String, trim: true, maxlength: 1000, default: "" }, html: { type: String, maxlength: 6000 } }, { _id: false });

const historySchema = new mongoose.Schema({ at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, action: String, version: Number, fields: [{ _id: false, field: String, from: String, to: String }] }, { _id: false });

// The question bank holds reusable questions, including incomplete ones an administrator still has to finish.
// Exams copy a snapshot from here; editing a bank question never changes an exam by itself.
const schema = new mongoose.Schema(
  {
    externalKey: { type: String, required: true, unique: true }, // the source ID, or "hash:<wording+options>" when the source has none
    externalId: { type: String, trim: true, maxlength: 80, index: true },
    subject: { type: String, trim: true, maxlength: 80, index: true },
    topic: { type: String, trim: true, maxlength: 120, index: true },
    subtopic: { type: String, trim: true, maxlength: 120 },
    text: { type: String, trim: true, maxlength: 8000, default: "" },
    options: { type: [optionSchema], default: [] },
    correctKey: { type: String, enum: OPTION_KEYS },
    textHtml: { type: String, maxlength: 20000 },                                  // sanitised formatting of the question (underlining, paragraphs)
    explanation: { type: String, trim: true, maxlength: 6000, default: "" },      // as stated by the source
    explanationHtml: { type: String, maxlength: 20000 },
    explanationSource: { type: String, trim: true, maxlength: 200 },               // e.g. "Extracted from source (not independently verified)"
    solution: {                                                                    // written by an administrator, never shown as source-verified
      text: { type: String, trim: true, maxlength: 4000 },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      at: Date,
      status: { type: String, enum: ["admin_written"] },
    },
    marks: { type: Number, default: 1 },
    questionType: { type: String, trim: true, maxlength: 60 },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], index: true }, // optional: only set when the source or an administrator provides it
    imageRef: { type: String, trim: true, maxlength: 300 },
    source: { refs: { type: [String], default: [] }, page: String, label: String, document: String },
    sourceStatus: { type: String, trim: true, maxlength: 40, index: true },        // the file's own Review_Status (Verified / Unverified / Needs Review), kept as found
    verification: {                                                                // OUR verification: only the explicit verify action changes it, never a plain save
      status: { type: String, enum: ["unverified", "verified"], default: "unverified", index: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      at: Date,
    },
    history: { type: [historySchema], default: [] },                              // audit trail (last 50 changes)
    review: {
      status: { type: String, enum: ["ready", "approved", "incomplete"], default: "ready", index: true },
      notes: { type: String, maxlength: 1000 },
      issues: { type: [String], default: [] },
    },
    extra: { type: mongoose.Schema.Types.Mixed },            // columns the importer did not recognise, kept as found
    problems: { type: [String], default: [] },               // what stops it being used (empty = usable)
    usable: { type: Boolean, default: false, index: true },
    awaitingSolution: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    importSession: { type: String, index: true },
    contentHash: String,
    stemHash: { type: String, index: true },
    edited: { type: Boolean, default: false },               // an administrator changed it: re-imports never overwrite it
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BankQuestion", schema);
