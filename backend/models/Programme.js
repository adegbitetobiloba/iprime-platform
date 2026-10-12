const mongoose = require("mongoose");

// A programme the institution offers. Created and edited only by an administrator; nothing is pre-filled.
const programmeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, trim: true, maxlength: 240 },       // one or two lines for cards
    description: { type: String, trim: true, maxlength: 3000 },
    audience: { type: String, trim: true, maxlength: 120 },      // e.g. the classes or levels it is for (free text)
    subjects: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    mode: { type: String, enum: ["", "physical", "online", "hybrid"], default: "" },
    schedule: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Programme", programmeSchema);
