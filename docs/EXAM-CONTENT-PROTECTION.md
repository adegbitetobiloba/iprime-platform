# ExamGuard content protection, start-page notice, and integrity on the analytics page

Built on main at `b594f8d` (2026-11-02). Branch: `feature/exam-content-protection`. Extends `docs/EXAM-GUARD-AND-OFFLINE.md`.

## What is new
1. **Questions cannot be selected, copied or long-pressed.** On the exam screen the question area is `user-select: none` with the touch callout off, so the browser's long-press menu (copy, "search the web", translate) no longer appears. Select-start, drag, copy, cut, paste, right-click, Ctrl/Cmd+A/C/X/P/S/U and printing are blocked, and images in questions cannot be long-pressed. Printing shows a notice instead of the exam. Controlled by the existing exam setting "Protect the questions" (`guard.blockCopyPaste`, on by default).
2. **Questions are hidden when the student leaves the screen.** The moment the page loses focus or is hidden the question text is hidden and replaced by "Return to the exam window to see the question". Any touch, click or key press brings it back.
3. **Notification panel.** A web page cannot block it and cannot reliably see it. What is done: the questions are hidden if the page loses focus, a long absence still counts as a warning, a clear swipe down from the top edge is written to the log (`edge_swipe`, not counted), and the start page tells students to use Do Not Disturb and Screen pinning (Android) or Guided Access (iPhone), which do stop notification swipes.
4. **Start page notice.** If ExamGuard is on, the exam start page lists exactly how the exam is monitored, before the student presses Start. `GET /api/exams/:id` now includes `guard`.
5. **Activity log** accepts four new browser reports: `select_blocked`, `print_blocked`, `shortcut_blocked`, `edge_swipe`. The admin timeline shows them in plain words.
6. **Integrity on the analytics page.** `/admin/analytics/exams/:id` now has an "Exam integrity" section: sittings, how many had warnings, submissions caused by the warning limit, answers sent after reconnecting, average time away, warnings per sitting, and a "Worth a look" list. `GET /api/admin/integrity/exams/:id` returns a `summary` for it. It never changes a score.

## Limits (be honest with staff)
- A website cannot stop a **screenshot, screen recording, Google Lens, Circle to Search or iPhone Live Text**. Those read the screen, not the page. Hiding the questions when the page loses focus only helps when the tool takes focus first.
- It cannot see **other devices**, a second screen or another person.
- The notification panel can be **neither blocked nor reliably detected** by a web page. Screen pinning / Guided Access, or a supervised room, is the real control.
- Students who rely on selecting text for accessibility can be accommodated by switching "Protect the questions" off for that examination. Screen readers are not affected by the selection block.
- Computers can be locked down properly only with a locked-down browser such as Safe Exam Browser (free), not by a web page.

## Files
Backend: `utils/guard.js`, `utils/integritySummary.js` (new), `controllers/adminIntegrityController.js`, `controllers/examController.js`, tests. Frontend: `lib/exam/useExamGuard.js`, `pages/ExamRunner.jsx`, `pages/ExamIntro.jsx`, `components/ExamSettings.jsx` (built on the current main version, which has the attempts link), `components/AttemptIntegrity.jsx`, `components/IntegritySummary.jsx` (new), `pages/admin/AdminExamAnalytics.jsx`, `examReliability.css`.

No database change. No new environment variable.
