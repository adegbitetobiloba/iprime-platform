// ExamGuard: the exam-security policy and the rule for what counts as a violation. Pure functions, no database.
//
// What it can and cannot do: a web page can notice that the student left the exam tab or window, exited fullscreen,
// or tried to copy and paste. It CANNOT see other devices, a second screen, screenshots, or another app on a phone
// that does not take the exam page out of focus. The server counts violations and enforces the limit; it can only
// count what the student's browser reports. Treat the log as evidence to review, not as proof.

const DEFAULT_GUARD = Object.freeze({
  enabled: true,            // master switch for this exam
  monitorFocus: true,       // leaving the exam tab/window counts as a violation
  requireFullscreen: false, // leaving fullscreen counts as a violation (browsers that cannot do fullscreen are not penalised)
  maxViolations: 3,         // the violation that reaches this number ends the exam
  autoSubmit: true,         // submit automatically when the limit is reached (false: only record and warn)
  minAwaySeconds: 2,        // leaving for less than this is ignored (a notification, a system pop-up)
  blockCopyPaste: true,     // block copy, cut, paste and the right-click menu while examining (logged, not counted)
});

const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const bool = (v, dflt) => (typeof v === "boolean" ? v : dflt);

// Any stored policy (missing, partial, or from an older exam) becomes a complete, valid one.
function normalizePolicy(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = DEFAULT_GUARD;
  return {
    enabled: bool(r.enabled, d.enabled),
    monitorFocus: bool(r.monitorFocus, d.monitorFocus),
    requireFullscreen: bool(r.requireFullscreen, d.requireFullscreen),
    maxViolations: Math.round(num(r.maxViolations, 1, 20, d.maxViolations)),
    autoSubmit: bool(r.autoSubmit, d.autoSubmit),
    minAwaySeconds: num(r.minAwaySeconds, 0, 30, d.minAwaySeconds),
    blockCopyPaste: bool(r.blockCopyPaste, d.blockCopyPaste),
  };
}

// What the student's browser may report. Anything else is refused by validation.
const CLIENT_EVENT_TYPES = ["away", "fullscreen_exit", "fullscreen_enter", "fullscreen_unsupported", "offline", "online", "copy_blocked", "paste_blocked", "contextmenu_blocked"];

// Does this reported event count as a violation under the policy? Network loss never does.
function classify(evt, policy) {
  if (!policy.enabled || !evt) return false;
  if (evt.type === "away") {
    return policy.monitorFocus && Number.isFinite(evt.durationMs) && evt.durationMs >= policy.minAwaySeconds * 1000;
  }
  if (evt.type === "fullscreen_exit") return policy.requireFullscreen;
  return false;
}

module.exports = { DEFAULT_GUARD, CLIENT_EVENT_TYPES, normalizePolicy, classify };
