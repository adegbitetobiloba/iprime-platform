// Public side of exam sharing: what a link shows, entering with a NAME, the examination PASSWORD, and opening a link
// from a signed-in account. A factory, so the database models and the token signer are passed in (tests use stand-ins).
const crypto = require("crypto");
const S = require("./shareAccess");
const L = require("./lockdown");
const pool = require("./pool");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v));
const STATUS = { revoked: 410, expired: 410, invalid: 404, unavailable: 403, not_yet: 403, closed: 403, full: 409 };
const hasPassword = (access) => Boolean(access && access.passwordHash);
const pwOk = (password, access) => S.verifyCode(password, { codeHash: access && access.passwordHash, codeSalt: access && access.passwordSalt });

function makeShareService({ ExamAccess, ExamShare, ShareGrant, ExamUnlock, Guest, Exam, jwt, getSecret }) {
  const bad = (res, status, error, code) => res.status(status).json({ error, ...(code ? { code } : {}) });

  async function load(token) {
    if (!S.looksLikeToken(token)) return { share: null };
    const share = await ExamShare.findOne({ token }).lean();
    if (!share) return { share: null };
    const exam = await Exam.findById(share.examId).lean();
    const access = exam ? await ExamAccess.findOne({ examId: exam._id }).lean() : null;
    return { share, exam, access, state: S.shareState(share, exam) };
  }

  // Counts one new person against the link's limit. Atomic, so two people cannot both take the last place.
  async function takePlace(share) {
    const filter = share.maxUses ? { _id: share._id, uses: { $lt: share.maxUses } } : { _id: share._id };
    const r = await ExamShare.updateOne(filter, { $inc: { uses: 1 } });
    return (r.modifiedCount ?? r.nModified ?? 0) === 1;
  }

  // GET /api/share/:token  (public)
  async function info(req, res) {
    const { share, exam, access, state } = await load(req.params.token);
    if (!share) return bad(res, 404, S.STATE_MESSAGE.invalid, "LINK_invalid");
    if (["revoked", "expired", "unavailable"].includes(state)) return res.json({ state, message: S.STATE_MESSAGE[state] });
    const lb = access && access.lockedBrowser;
    const required = Boolean(lb && lb.required);
    const seb = required ? L.check(req, lb) : { sebDetected: false, ok: false };
    const sh = pool.shape(exam);
    res.json({
      state, message: S.STATE_MESSAGE[state],
      share: { label: share.label || "", mode: share.mode, requireContact: Boolean(share.requireContact), needsPassword: hasPassword(access) },
      exam: { id: String(exam._id), title: exam.title, subject: exam.subject || "", level: exam.level || "", description: exam.description || "", instructions: exam.instructions || "", durationMinutes: exam.durationMinutes, questionCount: sh.questionCount, totalMarks: sh.totalMarks, maxAttempts: exam.maxAttempts || 1 },
      lockedBrowser: { required, detected: seb.sebDetected, ok: required ? seb.ok : true },
    });
  }

  // POST /api/share/:token/enter  (public) { name, contact?, password?, agree }
  async function enter(req, res) {
    const { share, exam, access, state } = await load(req.params.token);
    if (!share) return bad(res, 404, S.STATE_MESSAGE.invalid, "LINK_invalid");
    if (state !== "open" && state !== "full") return bad(res, STATUS[state] || 403, S.STATE_MESSAGE[state], `LINK_${state}`);
    if (share.mode === "account") return bad(res, 403, "This link is for signed-in iPrime students. Please log in to continue.", "ACCOUNT_REQUIRED");

    const body = req.body || {};
    const name = S.cleanName(body.name);                       // a NAME is required
    if (!name.ok) return bad(res, 400, name.error, "NAME_REQUIRED");
    const contact = S.cleanContact(body.contact);
    if (!contact.ok) return bad(res, 400, contact.error, "BAD_CONTACT");
    if (share.requireContact && !contact.value) return bad(res, 400, "Please enter an email address or phone number.", "CONTACT_REQUIRED");
    if (body.agree !== true) return bad(res, 400, "Please tick the box to confirm you understand how your details are used.", "CONSENT_REQUIRED");
    if (hasPassword(access) && !pwOk(body.password, access)) return bad(res, 403, body.password ? "That examination password is not correct." : "Enter the examination password.", "PASSWORD_REQUIRED");
    const lb = access && access.lockedBrowser;
    if (lb && lb.required && !L.check(req, lb).ok) return bad(res, 403, L.LOCKED_MESSAGE, "LOCKED_BROWSER_REQUIRED");

    // The same person coming back (recognised by contact) is the same guest, so attempts cannot be reset by re-entering.
    let guest = contact.key ? await Guest.findOne({ shareId: share._id, contactKey: contact.key }).lean() : null;
    if (!guest && state === "full") return bad(res, 409, S.STATE_MESSAGE.full, "LINK_full"); // only people already in may come back
    if (!guest) {
      if (!(await takePlace(share))) return bad(res, 409, S.STATE_MESSAGE.full, "LINK_full");
      try {
        const made = await Guest.create({ name: name.value, contact: contact.value || undefined, contactKey: contact.key || undefined, shareId: share._id, examId: share.examId });
        guest = made.toObject ? made.toObject() : made;
      } catch (err) {
        await ExamShare.updateOne({ _id: share._id, uses: { $gt: 0 } }, { $inc: { uses: -1 } }); // give the place back
        if (err && err.code === 11000 && contact.key) guest = await Guest.findOne({ shareId: share._id, contactKey: contact.key }).lean(); // two taps at once
        else throw err;
      }
    }

    const minutes = Math.min(720, (exam.durationMinutes || 60) + 180); // the exam plus time to read the result
    const payload = { id: String(guest._id), role: "guest", guest: true, name: guest.name, eid: String(share.examId), sid: String(share._id), pv: (access && access.passwordVersion) || 0, jti: crypto.randomUUID() };
    const token = jwt.sign(payload, getSecret(), { expiresIn: `${minutes}m` });
    res.json({ token, user: { id: payload.id, role: "guest", firstName: guest.name, lastName: "", guest: true }, examId: payload.eid });
  }

  // POST /api/share/:token/redeem  (signed-in student or admin)
  async function redeem(req, res) {
    const { share, state } = await load(req.params.token);
    if (!share) return bad(res, 404, S.STATE_MESSAGE.invalid, "LINK_invalid");
    if (state !== "open" && state !== "full") return bad(res, STATUS[state] || 403, S.STATE_MESSAGE[state], `LINK_${state}`);
    if (share.mode === "guest") return bad(res, 403, "This link is for people without an account. Use the name form instead.", "GUEST_ONLY");
    if (state === "full" && !(await ShareGrant.findOne({ shareId: share._id, userId: req.user.id }).lean())) return bad(res, 409, S.STATE_MESSAGE.full, "LINK_full");
    const r = await ShareGrant.updateOne({ shareId: share._id, userId: req.user.id }, { $setOnInsert: { examId: share.examId } }, { upsert: true });
    const added = (r.upsertedCount ?? (r.upserted ? 1 : 0)) === 1;
    if (added && !(await takePlace(share))) { await ShareGrant.deleteOne({ shareId: share._id, userId: req.user.id }); return bad(res, 409, S.STATE_MESSAGE.full, "LINK_full"); }
    res.json({ examId: String(share.examId) });
  }

  // Has this person already entered the CURRENT password for this exam?
  async function isUnlocked(req, examId, access) {
    if (!hasPassword(access)) return true;
    if (req.user.role === "admin") return true;
    const version = access.passwordVersion || 0;
    if (req.user.guest) return req.user.pv === version;
    const row = await ExamUnlock.findOne({ examId, userId: req.user.id }).lean();
    return Boolean(row && row.version === version);
  }

  // GET /api/share/exams/:id/status  (signed in, or guest): what the intro page needs to know.
  async function examStatus(req, res) {
    const id = req.params.id;
    if (!isId(id)) return bad(res, 404, "Examination not found");
    if (req.user.guest && req.user.eid !== id) return bad(res, 404, "Examination not found");
    const access = await ExamAccess.findOne({ examId: id }).lean();
    const lb = access && access.lockedBrowser;
    const lbRequired = Boolean(lb && lb.required);
    res.json({ passwordRequired: hasPassword(access), unlocked: await isUnlocked(req, id, access), lockedBrowserRequired: lbRequired, lockedBrowserOk: lbRequired ? L.check(req, lb).ok : true });
  }

  // POST /api/share/exams/:id/unlock { password }  (signed-in student/admin): enter the examination password.
  async function unlock(req, res) {
    const id = req.params.id;
    if (!isId(id)) return bad(res, 404, "Examination not found");
    if (req.user.guest) return bad(res, req.user.eid === id ? 409 : 404, req.user.eid === id ? "The password was entered when you opened the link. If it has changed, open the link again." : "Examination not found", "USE_LINK");
    const exam = await Exam.findById(id).select("status").lean();
    if (!exam || exam.status !== "published") return bad(res, 404, "Examination not found");
    const access = await ExamAccess.findOne({ examId: id }).lean();
    if (!hasPassword(access)) return res.json({ ok: true, passwordRequired: false });
    if (!pwOk((req.body || {}).password, access)) return bad(res, 403, "That examination password is not correct.", "BAD_PASSWORD");
    await ExamUnlock.updateOne({ examId: id, userId: req.user.id }, { $set: { version: access.passwordVersion || 0 } }, { upsert: true });
    res.json({ ok: true, passwordRequired: true });
  }

  // GET /api/share/seb-check?exam=ID  (public): lets an examiner confirm their Safe Exam Browser set-up before exam day.
  async function sebCheck(req, res) {
    const id = req.query.exam;
    if (!isId(id)) return bad(res, 400, "Add ?exam=<examination id> to the address.");
    const access = await ExamAccess.findOne({ examId: id }).lean();
    const lb = access && access.lockedBrowser;
    const required = Boolean(lb && lb.required);
    const c = L.check(req, lb || {});
    res.json({ required, sebDetected: c.sebDetected, ok: required ? c.ok : null, via: c.via });
  }

  return { info, enter, redeem, examStatus, unlock, sebCheck, isUnlocked };
}

module.exports = { makeShareService, hasPassword };
