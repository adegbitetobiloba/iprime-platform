const mongoose = require("mongoose");

// One thread per student, between that student and the administration team. There is deliberately no
// field or route that connects two students, so student-to-student messaging is impossible by design.
const conversationSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 160 },
    lastSenderRole: { type: String, enum: ["student", "admin"] },
    studentUnread: { type: Number, default: 0, min: 0 }, // messages from the team the student has not opened
    adminUnread: { type: Number, default: 0, min: 0 },   // messages from the student no administrator has opened
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
