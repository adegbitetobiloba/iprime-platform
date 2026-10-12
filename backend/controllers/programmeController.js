const mongoose = require("mongoose");
const Programme = require("../models/Programme");

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
const isId = (v) => mongoose.isValidObjectId(v);

// PUBLIC: only published programmes, only public fields.
exports.publicList = async (req, res) => {
  try {
    const items = await Programme.find({ status: "published" }).sort({ order: 1, createdAt: 1 })
      .select("title summary description audience subjects mode schedule").lean();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ programmes: items.map((p) => ({ id: String(p._id), ...p, _id: undefined })) });
  } catch (err) { serverError(res, err); }
};

// ADMIN (router requires the admin role)
exports.adminList = async (req, res) => {
  try {
    const items = await Programme.find().sort({ order: 1, createdAt: 1 }).lean();
    res.json({ programmes: items });
  } catch (err) { serverError(res, err); }
};

exports.create = async (req, res) => {
  try {
    const p = await Programme.create(req.body);
    res.status(201).json({ programme: p });
  } catch (err) { serverError(res, err); }
};

exports.update = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Programme not found" });
    const p = await Programme.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Programme not found" });
    p.set(req.body);
    await p.save();
    res.json({ programme: p });
  } catch (err) { serverError(res, err); }
};

exports.remove = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: "Programme not found" });
    const r = await Programme.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: "Programme not found" });
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
};
