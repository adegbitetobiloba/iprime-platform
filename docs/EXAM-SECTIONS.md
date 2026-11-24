# Per-subject quotas, result breakdown and scoreboard: contract (Workstream 1)
Additive. Exams that set none of this behave exactly as before. For the mobile stream: all new payload fields are optional additions.

## Exam fields
`sections: [{ subject, count }]` (per-subject quota for each student; the total is stored in `questionsPerStudent`). Set only through `PUT /api/admin/access/exams/:id/draw` (locked once published or attempted). There is no 500 limit (safety ceiling 20000).
## Draw rules
Each student gets exactly `count` questions from each listed subject, drawn at random from the pool's questions of that subject (the same spread / topic balance / retake rules as before, applied per subject). A subject with fewer questions than its quota gives all it has. Subject is matched case-insensitively; an exam question with no subject counts as the exam's own subject. With question shuffling on, a paper with several subjects keeps each subject together and shuffles within it.
## Student payload additions
Each question in the exam payload and the review has an optional `subject` string. Clients should show it at the top of the question.
## New endpoints (all under /api/share, mounted before the exam router)
- `GET /attempts/:id/breakdown` (owner or admin, submitted only) -> `{ overall: { questions, total, score, percentage, timeUsedSeconds, submittedAt }, subjects: [{ subject, questions, total, score, correct, incorrect, unanswered, percentage }] }` computed from the questions the attempt was given.
- `GET /exams/:id/leaderboard` (signed in or guest of that exam) and `GET /:token/leaderboard` (anyone with a live share link) -> `{ enabled:false }` unless the examiner switched it on, else `{ enabled:true, participants, entries:[{ rank, name, percentage, score, totalMarks, timeUsedSeconds, you }], you:{ rank, percentage, outOf } | null }`. Uses `rankFirstAttempts` from cohortAnalytics, so it always agrees with the analytics Top results. Names follow the examiner's choice (full / first name and initial / none). No account ids are returned.
## Admin endpoints (under /api/admin/access/exams/:id)
`PUT draw`, `PUT leaderboard`; `GET` now also returns `draw` (sections, pool by subject) and `access.leaderboard`. `POST /api/admin/bank/by-external` finds bank questions by external id; `POST /api/admin/bank/select` accepts `all:true` and counts up to 20000.
## For Analytics
Per-subject results are available through the breakdown helper `utils/results.js: breakdownBySubject(servedQuestions, answers, examSubject)`. Not yet in the CSV export.
