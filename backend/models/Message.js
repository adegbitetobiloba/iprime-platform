const mongoose = require("mongoose");

// Messages are never edited or deleted through the app, so a conversation is a reliable record.
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["student", "admin"], required: true },
    senderName: { type: String, maxlength: 80 }, // first name of the administrator, shown to staff only
    // Text is required unless the message carries an attachment.
    body: { type: String, trim: true, maxlength: 2000, default: "", required: function () { return !(this.attachments && this.attachments.length); } },
    attachments: { type: [new mongoose.Schema({ fileId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageFile" }, name: String, size: Number, contentType: String }, { _id: false })], default: [] },
    // A performance comment. Built by the SERVER from the student's real submitted attempt, never from client-supplied figures.
    context: {
      kind: { type: String, enum: ["attempt"] },
      attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt" },
      examTitle: String,
      subject: String,
      score: Number,
      totalMarks: Number,
      percentage: Number,
      submittedAt: Date,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("Message", messageSchema);
