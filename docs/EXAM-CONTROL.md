# ExamControl (live administration) and save-path speed

Built on main at `b594f8d` (2026-11-02), together with `docs/EXAM-CONTENT-PROTECTION.md` (upload this zip once; it contains both). Branch: `feature/exam-control`.

## What an administrator can do (examination edit page, "Live control", shown while the exam is published)
- **See who is sitting it now**, refreshed every 10 seconds: connection (connected / quiet / disconnected / paused), questions answered out of total, time left, and warnings.
  - Connected: the student's screen checked in within 1 minute. Quiet: 1 to 3 minutes. Disconnected: more than 3 minutes. A saved answer also counts as a sign of life.
- **Pause / resume** one student, or **everyone** (a power cut, a fire drill). The clock stops. Resuming gives back exactly the time that was left, with the same reconnection grace period. The student sees "Examination paused"; nothing is lost.
- **Add time** to one student or everyone: 5 to 60 minutes per action, at most 4 hours in total per attempt, only before the attempt's closing time.
- **Ask to submit** (gentle): the student's screen is told at its next check-in and submits itself, so answers still on the device are sent first. Closed as `admin_forced`.
- **End exam** (immediate): scored with the answers the server already has; anything still on the device is lost. Closed as `admin_terminated`. A confirmation explains this.
- Every action is written to the student's timeline (Attempts and integrity) with the administrator who did it.

## How it reaches the student (no paid real-time service)
The exam screen checks in with `POST /api/attempts/:id/heartbeat` about every 20 seconds (and when the connection returns). The reply carries the current deadline, whether it is paused, and any request to submit. Losing the network is harmless: the next check-in catches up.

## API (all admin only, under `/api/admin/integrity/control`)
`GET /exams/:id/live` · `POST /exams/:id/pause-all | resume-all | extend-all` · `POST /attempts/:id/pause | resume | extend | force-submit {mode: "ask"|"now"} | terminate`. Student side: `POST /api/attempts/:id/heartbeat` (30 per minute per student).
(Mounted from `adminIntegrityRoutes.js`, so `adminRoutes.js` is not touched.)

## Database (no migration)
`Attempt`: `lastSeenAt, pausedAt, pauseCount, pausedTotalSeconds, extraSeconds, adminCommand, totalQuestions`. Older attempts work unchanged. While `pausedAt` is set the sweeper never closes the attempt, saves answer `409 PAUSED`, and no warnings are counted.

## Speed (item 4)
- **Answer save** no longer loads the whole exam. It reads only the question ids and option letters, kept in memory for a minute (`utils/examCache.js`; question edits are locked once students have attempts). Per save: 2 reads and 1 write instead of 2 reads of the full exam and 1 write. The saving path is otherwise unchanged and the pause check is first.
- **Real MongoDB tests**: `backend/test/integration/realDb.test.js` checks the update operators, indexes, sweeper query, sync, event counting and pause/resume against a real database. Run locally with `MONGO_URI_TEST=mongodb://localhost:27017/iprime_test node --test test/integration/*.test.js`. CI runs it from `.github/workflows/integration.yml` against a throwaway MongoDB container. It is **advisory** (`continue-on-error`) so a problem in it cannot block a merge or deploy; remove that line once it has been green.

## Honest limits and numbers to watch
- Check-ins add one small write per student every 20 seconds (200 students is about 10 writes a second). On a free database tier, watch the operations-per-second limit during a big exam.
- Still to do for very large classes: starting an exam with a question pool reads all earlier attempts of that exam (it grows with class size), and the student exam list loads whole exams. Neither changed here.
- Pausing, adding time and ending an exam need the student's attempt to be in progress. "Ask to submit" waits for the next check-in (up to about 20 seconds); a student who is offline gets it when they reconnect.
- Ending an exam counts it as one of the student's attempts. To let them sit again, raise the exam's "attempts allowed" or create another exam.
- Tests: 78 unit tests pass against in-memory stand-ins. The real-database tests and all screens were not run in the build environment.
