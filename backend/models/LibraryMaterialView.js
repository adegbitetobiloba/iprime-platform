const mongoose = require("mongoose");

// Per student per material: how often it was opened and where the reader stopped.
const viewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    material: { type: mongoose.Schema.Types.ObjectId, ref: "LibraryMaterial", required: true, index: true },
    openCount: { type: Number, default: 0 },
    lastOpenedAt: { type: Date },
    lastPage: { type: Number, default: 1 },
    pageCount: { type: Number, default: 0 },
    percent: { type: Number, default: 0 }, // furthest point read, 0 to 100
    shelf: { type: String, enum: ["want", "reading", "done"] }, // private reading shelf (like Open Library's reading log)
    finishedAt: { type: Date }, // set once, so reaching the end moves it to Finished only the first time
  },
  { timestamps: true }
);
viewSchema.index({ user: 1, material: 1 }, { unique: true });
viewSchema.index({ user: 1, lastOpenedAt: -1 });

module.exports = mongoose.model("LibraryMaterialView", viewSchema);
