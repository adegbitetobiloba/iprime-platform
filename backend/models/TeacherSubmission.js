const mongoose = require("mongoose");

// A teacher's request to publish a course or an examination they drafted. Teachers can never publish; an administrator
// publishes it (or returns it with a note). One open request per item.
const submissionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["course", "exam"], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, maxlength: 200 }, // snapshot, so the queue still reads well if the item is renamed
    status: { type: String, enum: ["pending", "returned", "published", "withdrawn"], default: "pending" },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);
submissionSchema.index({ kind: 1, refId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });
submissionSchema.index({ status: 1, requestedAt: 1 });

module.exports = mongoose.model("TeacherSubmission", submissionSchema);
