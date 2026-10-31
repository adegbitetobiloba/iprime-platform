const mongoose = require("mongoose");

// Append-only record of who did what. Never put secrets, card data or full personal records in `meta`.
// There are no update or delete routes, and the hooks below refuse changes made through Mongoose.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: { type: String, trim: true, maxlength: 30 },
    entityType: { type: String, required: true, trim: true, maxlength: 40, index: true },
    entityId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    event: { type: String, required: true, trim: true, maxlength: 80 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

const refuse = async function () { throw new Error("Audit records cannot be changed or deleted."); };
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) auditLogSchema.pre(op, refuse);
auditLogSchema.pre("save", async function () { if (!this.isNew) throw new Error("Audit records cannot be changed or deleted."); });

module.exports = mongoose.model("AuditLog", auditLogSchema);
