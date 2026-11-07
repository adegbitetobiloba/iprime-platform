const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const hex = (n) => String(n).padStart(24, "0");
const orig = Module._load;
Module._load = function (req, parent, ...rest) { if (req === "mongoose" && parent && /utils[\\/]people\.js$/.test(parent.filename)) return { isValidObjectId: (v) => /^[0-9a-f]{24}$/i.test(String(v)) }; return orig.call(this, req, parent, ...rest); };
const people = require("../utils/people");

const mk = (users, guests, calls) => ({
  User: { find: (f) => ({ select: () => ({ lean: async () => { calls.users.push(f._id.$in.length); return users.filter((u) => f._id.$in.includes(String(u._id))); } }) }) },
  Guest: { find: (f) => ({ lean: async () => { calls.guests.push(f._id.$in.length); return guests.filter((g) => f._id.$in.includes(String(g._id))); } }) },
});
const users = [{ _id: hex(1), firstName: "Tobiloba", lastName: "Adegbite", studentId: "PET-1", email: "t@x.ng" }];
const guests = [{ _id: hex(61), name: "Ada Obi", contact: "ada@x.ng" }, { _id: hex(62), name: "Tunde Bello" }];

test("accounts and share-link guests are both found, and guests read like users so every existing screen shows their name", async () => {
  const calls = { users: [], guests: [] };
  const r = await people.list([hex(1), hex(61), hex(62), hex(99)], mk(users, guests, calls));
  assert.equal(r.length, 3, "the deleted account (hex 99) is absent, as before");
  const byId = new Map(r.map((p) => [String(p._id), p]));
  assert.equal([byId.get(hex(1)).firstName, byId.get(hex(1)).lastName].filter(Boolean).join(" "), "Tobiloba Adegbite");
  const g = byId.get(hex(61));
  assert.equal([g.firstName, g.lastName].filter(Boolean).join(" "), "Ada Obi (guest)");
  assert.deepEqual([g.studentId, g.email, g.guest], ["GUEST", "ada@x.ng", true]);
  assert.equal(byId.get(hex(62)).email, "");
});

test("guests are only looked up for people who are not accounts, and bad or repeated ids are ignored", async () => {
  const calls = { users: [], guests: [] };
  await people.list([hex(1), hex(1)], mk(users, guests, calls));
  assert.deepEqual(calls.guests, [], "everyone was an account, so no guest query");
  const c2 = { users: [], guests: [] };
  const r = await people.list(["not-an-id", null, undefined, hex(61), hex(61)], mk(users, guests, c2));
  assert.equal(r.length, 1); assert.deepEqual(c2.guests, [1]);
  assert.deepEqual(await people.list([], mk(users, guests, { users: [], guests: [] })), []);
  assert.deepEqual(await people.list(undefined, mk(users, guests, { users: [], guests: [] })), []);
});

test("an account always wins over a guest with the same id", async () => {
  const calls = { users: [], guests: [] };
  const r = await people.list([hex(1)], mk(users, [{ _id: hex(1), name: "Impostor" }], calls));
  assert.equal(r.length, 1); assert.equal(r[0].firstName, "Tobiloba");
});
