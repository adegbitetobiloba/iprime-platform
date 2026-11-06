# Performance Analytics: roadmap and status (Workstream 2)

Required by "Addendum 2 — Sequential implementation roadmap". One milestone is active at a time. Status values: Not started / Ready / In progress / Blocked / Implemented / Tested / Integrated / Accepted.
"Tested" here means automated tests run on the analytics code (see each row). Nothing below has been tested in a browser against the live site, or against a real database, by this workstream.

## Repository status block (this milestone)
- Official repository checked: https://github.com/adegbitetobiloba/iprime-platform
- Branch: `feature/analytics-m10-subjects-roadmap`; target branch: `main`
- Base commit (latest remote inspected): `766ca2c`
- Live frontend (https://iprime-web.onrender.com/) and API (https://iprime-api.onrender.com): not checked and not changed by this workstream. No production calls were made.
- Shared files touched: none
- Known failing tests that also fail on a clean `main` (not caused by this work): `test/adminAttempt.test.js`, "every top-level admin route has a menu link", `test/api.test.js`, `test/pool.test.js`, `test/randomisation.test.js` (5 failures before and after this branch)

## Source data and ownership
| Need | Source | Owner |
|---|---|---|
| Attempts, answers, scores, timing | `Attempt` (`status: submitted`) | Exam workstream |
| Questions an attempt was given | `attempt.questionIds` via `servedQuestions()` in `utils/randomise.js` | Exam workstream |
| Grading formula | `scoreAttempt()` in `utils/cbt.js` | Exam workstream |
| Teacher to student assignment | `TeacherAssignment` | Admin workstream |
| Registered subjects, mode, session | `Enrolment.subjectsRegistered/studyMode/session` | Admin workstream |
| Attendance | `Attendance` | Admin workstream |
| Audit entries | `AuditLog` through `utils/audit.js` | shared |

Analytics only reads these. It never changes an attempt, an exam or an enrolment.

## Milestones
| ID | Title | Status | Evidence |
|---|---|---|---|
| M1 | Trusted data and metric definitions | Integrated | `utils/analytics.js`, `docs/ANALYTICS.md` |
| M2 | Student analytics API | Integrated | `GET /api/student/analytics` |
| M3 | Cohort analytics per exam | Integrated | `utils/cohortAnalytics.js` |
| M4 | Admin analytics screens | Integrated | `AdminAnalytics`, `AdminExamAnalytics` |
| M5 | CSV export | Integrated | `utils/csv.js`, `utils/cohortExport.js` |
| M6 | Admin UX, library study view | Integrated | `AdminLibraryStudy` |
| M7 | Student progress report (print) | Integrated | `ProgressReport.jsx` |
| M8 | Export audit trail, recent downloads | Integrated | PR #64 |
| M9 | Teacher access to assigned students (backend) and paused-time fix | Integrated, no screen | PR #64 |
| M10 | Pooled-attempt grading fix, subject breakdown, docs, roadmap | Tested (automated), not yet integrated | this branch; `test/analyticsPool.test.js` |
| M11 | Registered-subject segmentation | Ready | needs nothing new; `Enrolment.subjectsRegistered` exists |
| M12 | Participation and attendance analytics | Blocked on one decision | needs "who was eligible for this exam"; see below |
| M13 | Teacher progress screen | Blocked on Teacher workstream | API exists (`/api/teacher/analytics`) |
| M14 | Baseline vs matched-student trends | Blocked on a definition | needs an approved meaning of "comparable" |
| M15 | Parent reports | Blocked on Admin contract | there is a `parent` role but no parent-to-student link |
| M16 | Class reports | Blocked on Admin contract | no class entity exists |

### M10 detail
- **Objective:** (1) Attempts from exams where each student gets a random draw of questions were graded against the whole pool, so they failed verification and vanished from topic and missed-question results. (2) The brief asks for a subject breakdown, which did not exist.
- **In scope:** `utils/analytics.js`, `utils/cohortAnalytics.js`, two controllers (select `questionIds`), Performance and exam-analytics screens, docs.
- **Out of scope:** any change to exam delivery, grading, the question bank or enrolment.
- **Acceptance:** a pooled attempt verifies; subjects are reported per student, per attempt and per cohort; a question seen by fewer than 5 students is not ranked; keys and explanations never appear in output.
- **Risks:** relies on `questionIds` being stored for drawn attempts (true in the current Exam code). If the question bank edit changes a question after an attempt, that attempt is still reported as unverifiable.

### M12 decision needed
A participation rate needs a list of students who were eligible to sit an exam (assigned, enrolled in the subject, or given access). `ExamAccess` and `Enrolment.subjectsRegistered` could define that, but "eligible" is a policy choice. Proposed rule for approval: a student is eligible if they have an approved enrolment whose `subjectsRegistered` includes the exam's subject. Until approved, no participation percentage is shown, and absentees are never counted as zero.

### Owner decisions required (management)
- Meaning of "comparable" for matched-student trends (M14).
- Ranking treatment for new candidates.
- Whether bulk exports need two-person approval (the brief lists it). Today an admin can download one exam's results and every download is logged.
- Retention period for analytics exports and audit entries.

## What is not claimed
- No browser or mobile-layout test has been run by this workstream (no package registry or browser build in its environment). Layout checks so far are static mock-ups.
- No test against a real MongoDB.
- Not deployed by this workstream.
