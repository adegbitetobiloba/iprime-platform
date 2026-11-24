// Student-facing extras for an examination: the per-subject result breakdown and the top-10 leaderboard.
// A factory (models and the ranking function are passed in) so it is tested without a database.
const { breakdownBySubject } = require("./results");
const { servedQuestions } = require("./randomise");
const S = require("./shareAccess");

const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v));
const toPlain = (m) => (m && typeof m.toObject === "function" ? m.toObject() : m instanceof Map ? Object.fromEntries(m) : m || {});
const bad = (res, status, error) => res.status(status).json({ error });
const TOP = 10, MAX_ROWS = 15; // ties at 10th place may show a few extra rows

// How a person is shown on a public scoreboard: "Ada Obi" (full), "Ada O." (short), "Student" (none).
function displayName(p, style) {
  if (style === "none" || !p) return "Student";
  const first = String(p.firstName || "").trim(), last = String(p.lastName || "").replace(/\(guest\)/i, "").trim();
  const parts = p.guest ? first.split(/\s+/).filter(Boolean) : [first, ...last.split(/\s+/)].filter(Boolean);
  if (!parts.length) return "Student";
  if (style === "full") return parts.join(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : parts[0];
}

function makeExamExtrasService({ Attempt, Exam, ExamAccess, ExamShare, people, rankFirstAttempts }) {
  // GET /attempts/:id/breakdown : overall result plus each subject, for the person who sat it (or an administrator).
  async function breakdown(req, res) {
    if (!isId(req.params.id)) return bad(res, 404, "Result not found");
    const attempt = await Attempt.findById(req.params.id).lean();
    if (!attempt || (String(attempt.userId) !== String(req.user.id) && req.user.role !== "admin")) return bad(res, 404, "Result not found");
    if (attempt.status !== "submitted") return bad(res, 409, "This attempt is still in progress.");
    const exam = await Exam.findById(attempt.examId).lean();
    if (!exam) return bad(res, 404, "The examination no longer exists.");
    const b = breakdownBySubject(servedQuestions(exam, attempt), toPlain(attempt.answers), exam.subject);
    const timeUsedSeconds = attempt.submittedAt && attempt.startedAt ? Math.max(0, Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000)) : null;
    res.json({ overall: { ...b.overall, timeUsedSeconds, submittedAt: attempt.submittedAt || null }, subjects: b.subjects });
  }

  // The top 10 for an exam, using the SAME ranking rules as the analytics (first submitted attempt per person, ties share a rank).
  async function board(examId, viewerId) {
    const access = await ExamAccess.findOne({ examId }).lean();
    const lb = (access && access.leaderboard) || {};
    if (!lb.enabled) return { enabled: false };
    const attempts = await Attempt.find({ examId, status: "submitted" }).select("userId percentage score totalMarks submittedAt startedAt autoSubmitted").lean();
    const { ranking, firsts } = rankFirstAttempts(attempts);
    const byAttempt = new Map(attempts.map((a) => [String(a._id), a]));
    const top = ranking.filter((r) => r.rank <= TOP).slice(0, MAX_ROWS);
    const folks = new Map((await people.list(top.map((r) => r.userId))).map((p) => [String(p._id), p]));
    const secs = (a) => (a && a.submittedAt && a.startedAt ? Math.max(0, Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 1000)) : null);
    const entries = top.map((r) => { const a = byAttempt.get(r.attemptId); return { rank: r.rank, name: displayName(folks.get(r.userId), lb.names || "short"), percentage: r.percentage, score: a ? a.score : null, totalMarks: a ? a.totalMarks : null, timeUsedSeconds: secs(a), you: viewerId ? r.userId === String(viewerId) : false }; });
    const mine = viewerId ? ranking.find((r) => r.userId === String(viewerId)) : null;
    return { enabled: true, participants: firsts.length, basis: "each person's first submitted attempt", entries, you: mine ? { rank: mine.rank, percentage: mine.percentage, outOf: firsts.length } : null };
  }

  // GET /exams/:id/leaderboard  (signed in, or a guest of that exam): even people who have not sat it may look.
  async function leaderboard(req, res) {
    if (!isId(req.params.id)) return bad(res, 404, "Examination not found");
    if (req.user.guest && req.user.eid !== req.params.id) return bad(res, 404, "Examination not found");
    const exam = await Exam.findById(req.params.id).select("status").lean();
    if (!exam || exam.status !== "published") return bad(res, 404, "Examination not found");
    res.json(await board(req.params.id, req.user.id));
  }

  // GET /:token/leaderboard  (public): anyone holding a live link can see the scoreboard, if the examiner allows it.
  async function leaderboardByLink(req, res) {
    if (!S.looksLikeToken(req.params.token)) return bad(res, 404, "This link is not valid.");
    const share = await ExamShare.findOne({ token: req.params.token }).lean();
    if (!share || share.revokedAt || (share.expiresAt && new Date(share.expiresAt) <= new Date())) return bad(res, 404, "This link is not valid.");
    const exam = await Exam.findById(share.examId).select("status").lean();
    if (!exam || exam.status !== "published") return res.json({ enabled: false });
    res.json(await board(String(share.examId), null));
  }

  return { breakdown, leaderboard, leaderboardByLink, board };
}

module.exports = { makeExamExtrasService, displayName };
