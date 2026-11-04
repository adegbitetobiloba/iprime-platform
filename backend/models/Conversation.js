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
    // An administrator can switch a student's messaging off (for example after abuse). The student can still read the thread.
    blocked: { at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, reason: { type: String, maxlength: 300 } },
    // Optional: the administrator who looks after this student's messages.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    assignedName: { type: String, maxlength: 80 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
