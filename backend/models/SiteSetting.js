const mongoose = require("mongoose");

// Small admin-editable texts (for example the enrolment notice). Nothing is pre-filled with fees or bank details.
const settingSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true, maxlength: 60 }, value: { type: String, maxlength: 2000, default: "" }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } },
  { timestamps: true }
);

module.exports = mongoose.model("SiteSetting", settingSchema);
