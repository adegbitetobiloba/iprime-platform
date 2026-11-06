const mongoose = require("mongoose");
const Achiever = require("../models/Achiever");
const { isPubliclyListable, toPublic } = require("../utils/achievers");

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
const isId = (v) => mongoose.isValidObjectId(v);
const notFound = (res) => res.status(404).json({ error: "Achiever not found" });

// PUBLIC: only records that pass isPubliclyListable, and only the public fields.
// "managed" tells the website whether an administrator has taken over (any record exists, even hidden or archived).
// Once managed, the website shows ONLY what this endpoint returns, so removing someone here removes them everywhere.
exports.publicList = async (req, res) => {
  try {
    const [any, docs] = await Promise.all([
      Achiever.exists({}),
      Achiever.find({ published: true, archived: { $ne: true }, verified: true, consent: "granted" }).sort({ order: 1, createdAt: 1 }).lean(),
    ]);
    res.set("Cache-Control", "public, max-age=30");
    res.json({ managed: Boolean(any), achievers: docs.filter(isPubliclyListable).map(toPublic) });
  } catch (err) { serverError(res, err); }
};

// ADMIN (the router requires the admin role)
exports.adminList = async (req, res) => {
  try {
    const items = await Achiever.find().sort({ archived: 1, order: 1, createdAt: 1 }).lean();
    res.json({ achievers: items });
  } catch (err) { serverError(res, err); }
};

exports.create = async (req, res) => {
  try {
    const a = await Achiever.create(req.body);
    res.status(201).json({ achiever: a });
  } catch (err) { serverError(res, err); }
};

exports.update = async (req, res) => {
  try {
    if (!isId(req.params.id)) return notFound(res);
    const a = await Achiever.findById(req.params.id);
    if (!a) return notFound(res);
    a.set(req.body);
    if (a.consent === "withdrawn") a.published = false;   // withdrawn consent always takes the person off the website
    await a.save();
    res.json({ achiever: a });
  } catch (err) { serverError(res, err); }
};

const setArchived = (archived) => async (req, res) => {
  try {
    if (!isId(req.params.id)) return notFound(res);
    const a = await Achiever.findById(req.params.id);
    if (!a) return notFound(res);
    a.archived = archived;
    if (archived) a.published = false;                      // an archived record is never public; restoring does not republish it
    await a.save();
    res.json({ achiever: a });
  } catch (err) { serverError(res, err); }
};
exports.archive = setArchived(true);
exports.restore = setArchived(false);
