const mongoose = require("mongoose");

// Small admin-managed settings (currently: the exam countdown).
const settingSchema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, value: mongoose.Schema.Types.Mixed, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } }, { timestamps: true });

// What students may see. Null when no countdown is set or it is switched off: nothing is invented.
settingSchema.statics.publicCountdown = async function publicCountdown() {
  const s = await this.findOne({ key: "countdown" }).lean();
  const v = s && s.value;
  if (!v || !v.enabled || !v.targetDate) return null;
  return { label: v.label, targetDate: new Date(v.targetDate).toISOString(), official: !!v.official, note: v.note || "" };
};

module.exports = mongoose.model("LibrarySetting", settingSchema);
