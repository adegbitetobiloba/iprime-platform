// Examiner-side controls for ONE examination: its password, who can find it, the locked-browser keys, and its share links.
// A factory (models and the audit writer are passed in) so it is tested without a database. Admin only (see the routes).
const S = require("./shareAccess");
const L = require("./lockdown");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v));
const DEFAULTS = { listed: true, lockedBrowser: { required: false, browserExamKeys: [], configKeys: [] } };

function makeAdminAccessService({ ExamAccess, ExamShare, ShareGrant, Guest, Exam, User, audit, invalidate = () => {} }) {
  const bad = (res, status, error) => res.status(status).json({ error });
  const log = (req, examId, event, meta) => audit(req, { entityType: "exam_access", entityId: examId, event, meta }); // never put the password, keys or link tokens in `meta`

  const publicAccess = (a) => {
    const x = a || {};
    return { listed: x.listed !== false, password: { set: Boolean(x.passwordHash), changedAt: x.passwordSetAt || null }, lockedBrowser: { required: Boolean(x.lockedBrowser && x.lockedBrowser.required), browserExamKeys: (x.lockedBrowser && x.lockedBrowser.browserExamKeys) || [], configKeys: (x.lockedBrowser && x.lockedBrowser.configKeys) || [] } };
  };
  const publicShare = (s) => ({ id: String(s._id), token: s.token, label: s.label || "", mode: s.mode, requireContact: Boolean(s.requireContact), expiresAt: s.expiresAt || null, maxUses: s.maxUses || null, uses: s.uses || 0, revokedAt: s.revokedAt || null, createdAt: s.createdAt || null, state: S.shareState(s, { status: "published" }) });

  async function examOr404(req, res) {
    if (!isId(req.params.id)) { bad(res, 404, "Examination not found"); return null; }
    const exam = await Exam.findById(req.params.id).select("title status").lean();
    if (!exam) { bad(res, 404, "Examination not found"); return null; }
    return exam;
  }

  // GET /exams/:id
  async function get(req, res) {
    if (!(await examOr404(req, res))) return;
    const [access, shares] = await Promise.all([ExamAccess.findOne({ examId: req.params.id }).lean(), ExamShare.find({ examId: req.params.id }).lean()]);
    res.json({ access: publicAccess(access), shares: shares.map(publicShare).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }

  // PUT /exams/:id  { listed?, lockedBrowser?: { required, browserExamKeys[], configKeys[] } }
  async function putAccess(req, res) {
    const exam = await examOr404(req, res); if (!exam) return;
    const b = req.body || {}; const set = { updatedBy: req.user.id };
    if (b.listed !== undefined) { if (typeof b.listed !== "boolean") return bad(res, 400, "Choose whether the examination is listed."); set.listed = b.listed; }
    if (b.lockedBrowser !== undefined) {
      const lb = b.lockedBrowser || {};
      const given = [...(Array.isArray(lb.browserExamKeys) ? lb.browserExamKeys : []), ...(Array.isArray(lb.configKeys) ? lb.configKeys : [])].filter((k) => String(k).trim());
      const invalid = given.filter((k) => !L.looksLikeKey(k));
      if (invalid.length) return bad(res, 400, `${invalid.length} key${invalid.length === 1 ? " is" : "s are"} not valid. A key is exactly 64 characters: the digits 0 to 9 and the letters a to f.`);
      const bek = L.normaliseKeys(lb.browserExamKeys), cfg = L.normaliseKeys(lb.configKeys);
      if (Boolean(lb.required) && !bek.length && !cfg.length) return bad(res, 400, "Add at least one Browser Exam Key or Config Key before requiring Safe Exam Browser, otherwise nobody could start the examination.");
      set.lockedBrowser = { required: Boolean(lb.required), browserExamKeys: bek, configKeys: cfg };
    }
    await ExamAccess.updateOne({ examId: req.params.id }, { $set: set }, { upsert: true });
    invalidate(req.params.id);
    await log(req, req.params.id, "access.updated", { listed: set.listed, lockedRequired: set.lockedBrowser ? set.lockedBrowser.required : undefined, browserExamKeys: set.lockedBrowser ? set.lockedBrowser.browserExamKeys.length : undefined, configKeys: set.lockedBrowser ? set.lockedBrowser.configKeys.length : undefined });
    res.json({ access: publicAccess(await ExamAccess.findOne({ examId: req.params.id }).lean()) });
  }

  // PUT /exams/:id/password  { password }   (set or change)
  async function putPassword(req, res) {
    if (!(await examOr404(req, res))) return;
    const pw = S.cleanPassword((req.body || {}).password);
    if (!pw.ok) return bad(res, 400, pw.error);
    const { codeHash, codeSalt } = S.hashCode(pw.value);
    const at = new Date();
    await ExamAccess.updateOne({ examId: req.params.id }, { $set: { passwordHash: codeHash, passwordSalt: codeSalt, passwordSetAt: at, updatedBy: req.user.id }, $inc: { passwordVersion: 1 } }, { upsert: true });
    invalidate(req.params.id);
    await log(req, req.params.id, "password.set", {});
    res.json({ password: { set: true, changedAt: at } });
  }

  // DELETE /exams/:id/password
  async function deletePassword(req, res) {
    if (!(await examOr404(req, res))) return;
    await ExamAccess.updateOne({ examId: req.params.id }, { $set: { passwordHash: null, passwordSalt: null, passwordSetAt: null, updatedBy: req.user.id }, $inc: { passwordVersion: 1 } }, { upsert: true });
    invalidate(req.params.id);
    await log(req, req.params.id, "password.removed", {});
    res.json({ password: { set: false, changedAt: null } });
  }

  // POST /exams/:id/shares  { label?, mode?, requireContact?, expiresAt?, maxUses? }
  async function createShare(req, res) {
    const exam = await examOr404(req, res); if (!exam) return;
    const b = req.body || {};
    const mode = b.mode === undefined ? "both" : b.mode;
    if (!["guest", "account", "both"].includes(mode)) return bad(res, 400, "Choose who may use the link.");
    const label = String(b.label || "").trim().slice(0, 80);
    let expiresAt;
    if (b.expiresAt) { expiresAt = new Date(b.expiresAt); if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return bad(res, 400, "The expiry must be a date and time in the future."); }
    let maxUses;
    if (b.maxUses !== undefined && b.maxUses !== null && b.maxUses !== "") { maxUses = Number(b.maxUses); if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) return bad(res, 400, "The number of people must be a whole number from 1 to 100000."); }
    const share = await ExamShare.create({ examId: req.params.id, token: S.newToken(), label, mode, requireContact: Boolean(b.requireContact) && mode !== "account", expiresAt, maxUses, createdBy: req.user.id });
    await log(req, req.params.id, "share.created", { label, mode, expires: Boolean(expiresAt), maxUses: maxUses || null });
    res.status(201).json({ share: publicShare(share.toObject ? share.toObject() : share) });
  }

  // DELETE /shares/:shareId   (withdraws the link: nobody new can use it; people already sitting the exam can finish)
  async function revokeShare(req, res) {
    if (!isId(req.params.shareId)) return bad(res, 404, "Link not found");
    const share = await ExamShare.findById(req.params.shareId).lean();
    if (!share) return bad(res, 404, "Link not found");
    if (!share.revokedAt) { await ExamShare.updateOne({ _id: share._id }, { $set: { revokedAt: new Date() } }); await log(req, share.examId, "share.revoked", { label: share.label || "" }); }
    res.json({ ok: true });
  }

  // GET /shares/:shareId/entries : who used this link (names are what guests typed)
  async function entries(req, res) {
    if (!isId(req.params.shareId)) return bad(res, 404, "Link not found");
    const share = await ExamShare.findById(req.params.shareId).lean();
    if (!share) return bad(res, 404, "Link not found");
    const [guests, grants] = await Promise.all([Guest.find({ shareId: share._id }).lean(), ShareGrant.find({ shareId: share._id }).lean()]);
    const users = grants.length ? await User.find({ _id: { $in: grants.map((g) => g.userId) } }).select("firstName lastName studentId").lean() : [];
    const byId = new Map(users.map((u) => [String(u._id), u]));
    res.json({
      guests: guests.map((g) => ({ id: String(g._id), name: g.name, contact: g.contact || "", enteredAt: g.createdAt || null })),
      accounts: grants.map((g) => { const u = byId.get(String(g.userId)); return { id: String(g.userId), name: u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "Deleted account", studentId: u ? u.studentId || null : null, openedAt: g.createdAt || null }; }),
    });
  }

  return { get, putAccess, putPassword, deletePassword, createShare, revokeShare, entries };
}

module.exports = { makeAdminAccessService };
