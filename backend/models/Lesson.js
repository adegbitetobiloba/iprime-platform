const mongoose = require("mongoose");
const { STATUSES, CONTENT_TYPES } = require("../utils/library");

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryCourse", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryModule", required: true, index: true },
    topicId: { type: mongoose.Schema.Types.ObjectId }, // _id of an entry in module.topics (optional)
    title: { type: String, required: true, trim: true, maxlength: 150 },
    order: { type: Number, default: 0 },
    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    // Written lessons are stored as plain Markdown text, never raw HTML. The frontend must render it with a safe renderer.
    body: { type: String, maxlength: 60000 },
    video: { provider: { type: String, enum: ["youtube", "vimeo"] }, videoId: String, url: String },
    // PDFs: the file lives in the private LibraryFile collection and is only ever streamed to a signed-in, permitted student.
    // There is no public or permanent URL, and no download button.
    pdf: { file: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryFile" }, originalName: String, size: Number },
    externalUrl: { type: String, trim: true, maxlength: 500 }, // https only
    estimatedMinutes: { type: Number, min: 0, max: 1000, default: 0 },
    // Practice link: reuses the existing Exam/question data. No questions are copied here.
    practice: {
      exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
      topic: { type: String, trim: true, maxlength: 120 }, // matches Exam question `topic`
    },
    requiresQuizPass: { type: Boolean, default: false },
    status: { type: String, enum: STATUSES, default: "draft", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
lessonSchema.index({ course: 1, module: 1, order: 1 });

module.exports = mongoose.model("LibraryLesson", lessonSchema);
