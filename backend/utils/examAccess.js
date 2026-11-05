// Access checks that sit IN FRONT of the existing exam routes (see routes/cbtRoutes.js). They never change the exam
// controller or Exam Guard; they only decide whether a request may reach them. A factory, so tests pass stand-ins.
//
//   studentOrGuest : signed-in student/admin as before, OR a guest holding a link session (limited to its one exam)
//   hideUnlisted   : link-only examinations do not appear in the examination list
//   examGate       : /exams/:id        link-only access, link still active, locked browser, examination password
//   attemptGate    : /attempts/:id/... locked browser must be used for the whole attempt
const L = require("./lockdown");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v));
const hasPassword = (a) => Boolean(a && a.passwordHash);

function makeAccess({ ExamAccess, ExamShare, ShareGrant, ExamUnlock, Attempt, requireRole, lockdown = L, ttlMs = 15000, now = () => Date.now() }) {
  const cache = new Map(); // examId -> { at, value }   (a short cache: save calls come several times a minute per student)
  const attemptExam = new Map(); // attemptId -> examId (never changes)

  async function policy(examId) {
    const hit = cache.get(String(examId));
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = await ExamAccess.findOne({ examId }).lean();
    cache.set(String(examId), { at: now(), value });
    if (cache.size > 2000) cache.clear();
    return value;
  }
  const invalidate = (examId) => { if (examId) cache.delete(String(examId)); else cache.clear(); };

  const isGuest = (req) => Boolean(req.user && req.user.guest === true && req.user.role === "guest");
  const needLockedBrowser = (req, res, access) => {
    const lb = access && access.lockedBrowser;
    if (!lb || !lb.required) return false;
    if (lockdown.check(req, lb).ok) return false;
    res.status(403).json({ error: lockdown.LOCKED_MESSAGE, code: "LOCKED_BROWSER_REQUIRED" });
    return true;
  };

  function studentOrGuest(req, res, next) {
    if (!isGuest(req)) return requireRole("student", "admin")(req, res, next);
    // A guest may only use the examination their link opened.
    const m = req.path.match(/^\/exams(?:\/([^/]+))?/);
    if (req.path.startsWith("/attempts")) return next();
    if (m && m[1]) return m[1] === req.user.eid ? next() : res.status(404).json({ error: "Examination not found" });
    return res.status(403).json({ error: "This link gives access to one examination only." });
  }

  async function examGate(req, res, next) {
    try {
      const id = req.params.id;
      if (!isId(id)) return next();
      if (!isGuest(req) && req.user.role === "admin") return next();
      const guest = isGuest(req);
      const isStart = req.method === "POST" && /^\/start\/?$/.test(req.path);
      const access = await policy(id);

      // Link-only examinations: a signed-in student needs to have opened a live link (or already be sitting it).
      if (!guest && access && access.listed === false) {
        const grants = await ShareGrant.find({ examId: id, userId: req.user.id }).select("shareId").lean();
        const shares = grants.length ? await ExamShare.find({ _id: { $in: grants.map((g) => g.shareId) } }).select("revokedAt expiresAt").lean() : [];
        const live = shares.some((s) => !s.revokedAt && (!s.expiresAt || new Date(s.expiresAt) > new Date(now())));
        const sitting = live ? true : Boolean(await Attempt.findOne({ examId: id, userId: req.user.id, status: "in_progress" }).select("_id").lean());
        if (!sitting) return res.status(404).json({ error: "Examination not found" });
      }
      if (!isStart) return next();

      if (guest) { // new starts need a link that is still active (people already sitting can finish)
        const share = await ExamShare.findById(req.user.sid).select("revokedAt expiresAt").lean();
        if (!share || share.revokedAt || (share.expiresAt && new Date(share.expiresAt) <= new Date(now()))) return res.status(403).json({ error: "This link is no longer active.", code: "LINK_closed" });
      }
      if (needLockedBrowser(req, res, access)) return;
      if (hasPassword(access)) {
        const sitting = await Attempt.findOne({ examId: id, userId: req.user.id, status: "in_progress" }).select("_id").lean(); // resuming never needs the password again
        if (!sitting) {
          const version = access.passwordVersion || 0;
          let ok;
          if (guest) ok = req.user.pv === version;
          else { const row = await ExamUnlock.findOne({ examId: id, userId: req.user.id }).lean(); ok = Boolean(row && row.version === version); }
          if (!ok) return res.status(403).json({ error: guest ? "The examination password has changed. Open the link again and enter the new password." : "Enter the examination password to continue.", code: "PASSWORD_REQUIRED" });
        }
      }
      next();
    } catch (err) { next(err); }
  }

  async function attemptGate(req, res, next) {
    try {
      const id = req.params.id;
      if (!isId(id) || (!isGuest(req) && req.user.role === "admin")) return next();
      if (/^\/result\/?$/.test(req.path)) return next(); // results can be read in any browser
      let examId = attemptExam.get(id);
      if (!examId) {
        const a = await Attempt.findById(id).select("examId").lean();
        if (!a) return next();
        examId = String(a.examId); attemptExam.set(id, examId);
        if (attemptExam.size > 5000) attemptExam.clear();
      }
      if (needLockedBrowser(req, res, await policy(examId))) return;
      next();
    } catch (err) { next(err); }
  }

  // Link-only exams never show in the list (unless this account opened a live link to them).
  async function hideUnlisted(req, res, next) {
    try {
      if (isGuest(req) || req.user.role === "admin") return next();
      const hidden = (await ExamAccess.find({ listed: false }).select("examId").lean()).map((r) => String(r.examId));
      if (!hidden.length) return next();
      const mine = new Set((await ShareGrant.find({ userId: req.user.id, examId: { $in: hidden } }).select("examId").lean()).map((g) => String(g.examId)));
      const json = res.json.bind(res);
      res.json = (body) => json(body && Array.isArray(body.exams) ? { ...body, exams: body.exams.filter((e) => !hidden.includes(String(e.id || e._id)) || mine.has(String(e.id || e._id))) } : body);
      next();
    } catch (err) { next(err); }
  }

  return { studentOrGuest, examGate, attemptGate, hideUnlisted, invalidate };
}

module.exports = { makeAccess };
