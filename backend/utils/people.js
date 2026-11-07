// One place to turn an attempt's userId into a person for ADMIN screens: a real account OR a share-link guest.
//
// Guests are returned in the same shape as a user ({ _id, firstName, lastName, studentId, email }), so the existing
// screens, which build a name from firstName + lastName, show "Ada Obi (guest)" with the ID "GUEST" without any other change.
// A person who is in neither table (a deleted account) is simply absent, exactly as before.
const mongoose = require("mongoose");

const GUEST_ID = "GUEST";
const guestAsUser = (g) => ({ _id: g._id, firstName: g.name, lastName: "(guest)", studentId: GUEST_ID, email: g.contact || "", guest: true });

// deps are injectable for tests; by default the real models are used.
async function list(ids, deps = {}) {
  const User = deps.User || require("../models/User");
  const Guest = deps.Guest || require("../models/Guest");
  const valid = [...new Set((ids || []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!valid.length) return [];
  const users = await User.find({ _id: { $in: valid } }).select("firstName lastName studentId email").lean();
  const known = new Set(users.map((u) => String(u._id)));
  const missing = valid.filter((id) => !known.has(id));
  const guests = missing.length ? await Guest.find({ _id: { $in: missing } }).lean() : []; // only asked about people who are not accounts
  return [...users, ...guests.map(guestAsUser)];
}

module.exports = { list, guestAsUser, GUEST_ID };
