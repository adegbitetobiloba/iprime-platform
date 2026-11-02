# ExamGuard, activity log, and offline submission (milestones M1.1, M2, M3)

Built on main at `0decbcc` (2026-11-01). Branch: `feature/exam-guard`. Extends `docs/CBT.md` and `docs/EXAM-RELIABILITY-M1.md`; nothing in them is weakened.

## 1. Offline submission and the "time is up" screen (M1.1)
- Unsent answers stay on the device with the time each was given. At 00:00 the answers lock, the screen says "Time is up", and it submits by itself (retrying every 5 seconds while offline).
- A **reconnection grace period** (`EXAM_RECONNECT_GRACE_MINUTES`, default 10, `0` = off, max 60) keeps the attempt open after the deadline. In that window `POST /api/attempts/:id/sync` accepts only answers whose device timestamp is before the deadline (5 s clock tolerance), after the start, for questions in that student's own paper. Attempts that used it are flagged `lateSynced`.
- Device clocks cannot be proven. The protection is the short window, the server rules, the review flag, and the switch to turn it off.

## 2. Activity log (M2)
New collection `attemptevents` (append-only): `attemptId, examId, userId, type, source, eid, at (server time), clientAt, durationMs, counted, meta`.
- Server entries: `exam_started`, `exam_resumed`, `submitted`, `auto_submitted_time`, `auto_submitted_violations`, `answers_synced_late`.
- Browser reports (only these types are accepted): `away`, `fullscreen_exit`, `fullscreen_enter`, `fullscreen_unsupported`, `offline`, `online`, `copy_blocked`, `paste_blocked`, `contextmenu_blocked`.
- Answer saving is recorded as counters on the attempt (`saveCount`, `lastSavedAt`) instead of one row per click, to keep saves fast.
- Resent events carry an id and are never counted twice. Cap: 1500 rows per attempt.
- No retention rule is applied yet; the owner should decide one (see the brief's privacy section).

## 3. ExamGuard (M3)
Per-exam settings (admin: Examination, Details, "Exam security"), copied onto each attempt when it starts:
| Setting | Default |
|---|---|
| Monitor this examination | on |
| Warn when leaving the exam tab/window | on |
| Require fullscreen | off |
| Block copy, paste, right-click (logged, not counted) | on |
| Submit automatically at the limit | on |
| Warnings allowed | 3 |
| Ignore absences shorter than | 2 seconds |

How it works: the browser reports each time the student leaves and returns (tab hidden or window unfocused, with the duration). **The server counts**: an absence of at least the minimum counts as one violation; the student sees "Warning 1 of 3", "Warning 2 of 3"; the third submits the exam, scoring the answers already saved, with `submitReason: "violation_limit"`. Unsent answers are sent before the report so they are not lost.

What it never counts: losing the internet connection, short absences, anything after the deadline (grace period), or anything when the guard is off. Exams created before this change use the defaults above.

## 4. Integrity report (admin)
- `GET /api/admin/integrity/exams/:id`: one row per attempt (status and reason, score, warnings, time away, late-sync flag).
- `GET /api/admin/integrity/attempts/:id/events`: the timeline of one attempt.
- Shown on the examination edit page under "Attempts and integrity". Admin only.

## 5. Honest limits
A web page can see only that the exam tab or window lost focus, fullscreen was left, or copy/paste was tried. It cannot see other devices, screenshots, a second person, or an app that does not take the page out of focus. A student who stops the page reporting (for example by blocking its network) cannot be detected until reports resume. Use the log as evidence to review, not as proof. iPhones cannot do fullscreen, so "require fullscreen" is skipped there and logged as unsupported. ExamControl (pause, extend time, force-submit, live monitoring) is the next milestone.

## 6. Environment
`EXAM_RECONNECT_GRACE_MINUTES` (default 10), `EXAM_SWEEP_SECONDS` (default 60). Neither is a secret.

## 7. API changes
- New: `POST /api/attempts/:id/events` (60/min per student), `POST /api/attempts/:id/sync` (30/min), admin integrity routes above.
- `PUT /api/attempts/:id/answers` returns `409 TIME_UP` inside the grace period (it does not close the attempt).
- Attempt payloads include `guard`, `violations`, `closeAt`, `timeUp`; results include `submitReason`.

## 8. Database (no migration)
`Exam.guard` (optional object). `Attempt`: `closeAt, graceSeconds, lateSynced, lateSyncedAt, lateSyncedCount, lateSyncRejected, guard, violations, submitReason, saveCount, lastSavedAt`. New collection `attemptevents` with indexes. Older documents work unchanged.

## 9. Known follow-up
`ResultDetail.jsx` still says "time ran out" for any automatic submission. For a violation submission it should say the warning limit was reached: use `r.submitReason === "violation_limit"`.

## 10. Also fixed in `ExamRunner.jsx`
The version on main (from the calculator update) had lost shuffled option letters (`label`), formatted question text (`SafeHtml`), and the M1 save pill / device-kept answers. All are restored.
