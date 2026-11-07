# API_CONTRACT.md — Account 6 baseline v0 (2026-11-07)

Status: BASELINE, read from `backend/` on main by Account 6. It adds to, and does not replace, the Manager's CONTRACTS v1_1 and v1_2. If code and this file disagree, code wins; report it.
Not yet adopted by the Manager. Sections marked PROPOSED are NOT built.

## Environments
- Production: `https://iprime-api.onrender.com` (from docs/EXAM-SCALE-AND-RETENTION.md; not re-checked). Mobile must not use it for testing.
- Staging: to be created (docs/mobile/STAGING_SETUP.md). URL will be given by the owner.
- `GET /health` -> `{status, db, commit?}`. Use it as the wake-up probe. Free plan sleeps after ~15 min; first call can take ~1 min.

## Verified behaviours that affect the app (read from code)
1. Mount order. `app.use("/api", cbtRoutes)` guards every `/api` path that reaches it with sign-in and student/admin/guest role. New routers (config, devices, push, sync, parent) must be mounted BEFORE it, in `app.js`.
2. Roles. Library, dashboard, analytics, exams use `requireRole("student","admin")`: parent and teacher accounts get 403. Messaging is student-only. Teachers use `/api/teacher/*` with their own login. Parents can self-register but have no screens yet.
3. ExamGuard events. `POST /attempts/:id/events` accepts only: away, fullscreen_exit, fullscreen_enter, fullscreen_unsupported, offline, online, copy_blocked, paste_blocked, contextmenu_blocked, select_blocked, print_blocked, shortcut_blocked, edge_swipe. `reasons` may only be "hidden" or "blur". ONE unknown type makes the whole batch (max 50) fail with 400, so the app must not send other types yet.
   Interim mobile rule (no backend change): report the app leaving the foreground as `away` with `durationMs` and `reasons:["hidden"]`. The server counts it when durationMs >= the exam's minAwaySeconds*1000 and never counts it while paused, after the deadline, or with guard off.
   New policy keys need changes in THREE places: Mongoose `guardSchema` (models/Exam.js), Joi `guard` (validations/cbtValidation.js), `normalizePolicy` (utils/guard.js).
4. Locked-browser exams return 403 `{code:"LOCKED_BROWSER_REQUIRED"}` on start. A phone cannot satisfy it. The exam list does not say which exams need it. Show a plain message and suggest a computer.
5. Exam password: 403 `{code:"PASSWORD_REQUIRED"}` on start. The unlock route is not yet read.
6. Not the owner of an attempt -> 404, not 403.
7. Rate limits: exam routes are per student (answers 240/min, heartbeat 30/min, events 60/min, sync 30/min). Auth (30/15 min), library progress (120/min) and PDF/image (30/min) limits are per IP, so shared networks can be throttled. Show a retry message on 429.
8. Sign-in. Pending-approval accounts get no token. 7-day token, no refresh. Call `POST /auth/logout` on sign-out; treat 401 as signed out. No forgot-password route exists. No self-service account deletion exists.
9. Library files. PDFs and images stream with `Accept-Ranges`, `ETag` (SHA-256) and 304 support, `Cache-Control: private, no-cache`, served `inline`. The platform deliberately offers no download today; offline saving needs a per-item permission (PROPOSED, needs owner decision on content rights).
10. Lesson then test already exists in a basic form: a lesson may link a practice Exam (`practice` in `GET /library/lessons/:id`); `POST /library/lessons/:id/practice-check` reports the best submitted percentage (pass mark 50). Topic quizzes drawn from the question bank do not exist yet.
11. Offline progress. `PUT /library/lessons/:id/progress` limits page jumps (+3 per call) and video growth by server time between calls. Do not batch offline progress through it; a dedicated op is PROPOSED (B5).
12. Messaging. `GET /messages/stream` is Server-Sent Events from one server process. v1 should poll `GET /messages/unread` and `GET /messages/thread`.
13. Google. `POST /auth/google` verifies `aud` equals the single `GOOGLE_CLIENT_ID`. Request the token with the web client id as the server client id and the server-issued nonce. Not yet tested on a device.

## PROPOSED additions (not built; each needs a Contract Change Proposal D before others build on it)
- P0: `GET /api/app/config` (public): min app version, feature flags and kill switches, maintenance message. Needed for the first visible milestone (M1).
- P1: `POST /api/devices/register`; push token registration and preferences; richer ExamGuard event types and policy keys; an exam-list flag for locked-browser exams; forgot/reset password; self-service account deletion.
- Later: offline packs and manifest, sync batch with idempotency keys, topic quizzes, parent link, social features (after owner policy decisions O2 and O4).
