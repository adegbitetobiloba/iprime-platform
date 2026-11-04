const SiteSetting = require("../models/SiteSetting");
const { audit } = require("../utils/audit");

const serverError = (res, err) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); };
const KEYS = { notice: "enrolmentNotice", paymentInstructions: "paymentInstructions" };
// Shown to students until the office writes its own. It promises nothing about amounts, accounts or timing.
const DEFAULTS = { notice: "Before you can open the student registration form, the office must confirm your payment. Pay as the office instructs, then wait for the confirmation. This page updates as soon as it is confirmed.", paymentInstructions: "" };

async function read() {
  const rows = await SiteSetting.find({ key: { $in: Object.values(KEYS) } }).lean();
  const by = new Map(rows.map((r) => [r.key, r]));
  const out = {};
  for (const [name, key] of Object.entries(KEYS)) { const r = by.get(key); out[name] = r && r.value ? r.value : DEFAULTS[name]; }
  out.updatedAt = rows.reduce((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null);
  out.isDefault = { notice: !(by.get(KEYS.notice) && by.get(KEYS.notice).value), paymentInstructions: !(by.get(KEYS.paymentInstructions) && by.get(KEYS.paymentInstructions).value) };
  return out;
}

exports.read = read;
// GET /api/admin/settings/enrolment
exports.get = async (req, res) => { try { res.json(await read()); } catch (err) { serverError(res, err); } };
// PUT /api/admin/settings/enrolment { notice?, paymentInstructions? } : sending an empty text puts the default back
exports.put = async (req, res) => {
  try {
    for (const name of Object.keys(KEYS)) {
      if (req.body[name] === undefined) continue;
      await SiteSetting.findOneAndUpdate({ key: KEYS[name] }, { $set: { value: req.body[name], updatedBy: req.user.id }, $setOnInsert: { key: KEYS[name] } }, { upsert: true, new: true });
    }
    await audit(req, { entityType: "settings", entityId: "enrolment", event: "settings.enrolment_updated", meta: { fields: Object.keys(req.body) } });
    res.json(await read());
  } catch (err) { serverError(res, err); }
};
