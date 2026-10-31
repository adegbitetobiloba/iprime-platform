const mongoose = require("mongoose");

// A chapter inside a course. Topics sit inside the chapter; lessons point at a topic.
const topicSchema = new mongoose.Schema({ title: { type: String, required: true, trim: true, maxlength: 150 } });

const moduleSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryCourse", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    order: { type: Number, default: 0 },
    topics: [topicSchema], // array order is the topic order
  },
  { timestamps: true }
);
moduleSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model("LibraryModule", moduleSchema);
