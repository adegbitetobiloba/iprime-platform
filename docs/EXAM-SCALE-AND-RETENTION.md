# Speed for large classes, small fixes, and keeping the API awake

Built on main at `766ca2c` (2026-11-05), after the sharing/guest-access and analytics merges. Branch: `feature/exam-scale-retention`. Extends `docs/EXAM-CONTROL.md`.

## 1. Speed for large classes
- **Starting an exam with a question pool.** Before, every start pulled every earlier attempt of the exam into memory to count how often each question had been used, so it got slower with every student who had started (and the total work grew with the square of the class size). Now it is one grouped database query that returns at most one row per question, plus the student's own few attempts (`utils/pool.js`, `loadUsage`). The draw itself is unchanged. Anything without `aggregate()` (a test stand-in) uses the earlier way, so existing tests are not affected.
- **The student's exam list.** It used to load every published exam with all its questions, options and explanations just to show counts. Now the question count and total marks are computed in the database and the questions are not loaded (`utils/examList.js`). The numbers shown are unchanged. `pool.shapeFromTotals` does the same arithmetic as `pool.shape` from totals.
- **Matches the latest total-marks fix.** `main` now reports each student's own paper (for example 40 questions and 40 marks from a pool of 300). The faster list uses the same arithmetic (`pool.shapeFromTotals`), so those numbers are identical.
- **Existing tests keep working.** The repo's `pool.test.js` runs the real controller against a fake database that has no `aggregate()`. The list and the usage count both fall back to the earlier way when `aggregate()` is missing, so that test is unaffected.
- Not changed: the admin exam list and a single exam's start page still load whole exams (one or a few documents, not a problem at class size).

## 2. Small fixes
- **Results page wording.** It now says why an exam was submitted automatically: time ran out, the warning limit was reached, or an examiner submitted / ended it. Older attempts with no recorded reason keep the original "time ran out" wording.
- **Reconnection window per exam.** In the exam's Details, "If a student's internet drops": minutes after time is up in which an offline student may still send answers given before the deadline. Empty uses the server default (`EXAM_RECONNECT_GRACE_MINUTES`, 10), `0` switches it off, maximum 60. Copied onto each attempt when it starts, so editing it never changes a running exam.
- **Retention of activity records.** The per-attempt timeline (tab-away reports, pauses and so on) is deleted after `EXAM_EVENT_RETENTION_DAYS` (default 365; `0` keeps forever; maximum 3650). A daily job does it. Attempts, answers, scores and results are never deleted. Admins see the period on the "Attempts and integrity" panel. **365 days is a default for the owner to confirm**, as the brief says retention must be stated.

## 3. Keeping the API awake (`.github/workflows/keepalive.yml`)
Render's free plan puts the API to sleep after about 15 minutes with no visitors; the next person waits up to a minute, and the timed auto-close cannot run while it sleeps. This workflow pings the health address every 10 minutes between 06:00 and 22:59 in Nigeria. The repository is public, so scheduled workflows are free.
**To switch it on:** GitHub, Settings, Secrets and variables, Actions, Variables tab, New repository variable: name `API_HEALTH_URL`, value `https://iprime-api.onrender.com/health`. Without that variable it does nothing; delete the variable to switch it off.
- During an exam the server stays awake anyway, because every student's screen checks in every 20 seconds.
- When the server wakes up, the sweeper runs 5 seconds after start and closes anything that ran out of time while it slept.
- **Check Render's free allowance** (about 750 instance hours a month for the whole workspace, as far as I know; confirm in your dashboard). One service awake all month fits; two do not. These hours keep the API awake about 70% of the month.
- GitHub pauses scheduled workflows in a repository with no activity for 60 days; any commit restarts them.

## 4. Tests
91 unit tests pass against in-memory stand-ins (13 new), and the controller half of the repo's own `pool.test.js` passes against the rebased controller. `backend/test/integration/realDb.test.js` gained three real-database checks (usage query, list query, retention purge); they run in the advisory CI job and were not run in the build environment.

## 5. Files
Backend: `utils/pool.js`, `utils/examList.js` (new), `utils/retention.js` (new), `utils/lateSync.js`, `utils/attemptSweeper.js`, `controllers/examController.js`, `controllers/adminIntegrityController.js`, `models/Exam.js`, `models/AttemptEvent.js`, `validations/cbtValidation.js`, tests. Frontend: `pages/ResultDetail.jsx`, `components/ExamSettings.jsx`, `components/AttemptIntegrity.jsx`. Workflow: `keepalive.yml`. No migration.
