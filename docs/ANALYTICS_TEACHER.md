# Teacher access to performance analytics (workstream 2, M9)

Backend only. The Teacher workstream owns the teacher screens; this is the contract they can call.

## Who sees what
- A signed-in, **approved** teacher (re-checked in the database on every request).
- Only students with an **active** `TeacherAssignment` to that teacher, and only while the student is approved. Ending an assignment removes access immediately.
- Identity is name and student ID only. No email, phone, address, guardian, medical or payment data.
- If the assignment lists `subjects`, only attempts of examinations in those subjects are used. No list means no restriction.
- Correct answers and explanations are never returned.
- A student that does not exist, is not assigned, is suspended, or an id that is malformed all get the same `404 Student not found.`

## Endpoints (all under `/api/teacher/analytics`)
| Route | Returns |
|---|---|
| `GET /students` | One row per assigned student: attempts, average, latest result, trend, up to 3 topics needing practice, `checkIn`. |
| `GET /students/:studentId` | `student`, `scope`, `summary`, and the same analytics the student sees (`history`, `topics`, `recurringMisses`, `retests`, `focus`). |

## Plain rules (shown with their reason in the UI, no hidden scoring)
- **trend:** needs the latest result plus at least 2 earlier attempts. `improving` when the latest is 5 or more points above the earlier average, `declining` when 5 or more below, else `steady`; fewer attempts gives `not_enough_data`.
- **checkIn:** true when the latest result is under 40%. Wording should be "worth a check-in", never a label for the student.
- Topic bands are the same as the student's (minimum 5 questions of evidence).

## Audit
Opening one student's analytics writes `analytics.teacher_viewed_student` (entity `teacher_view`) **before** any data is sent. If it cannot be written, nothing is returned. The list view is not logged (it holds only summaries).

## Also in M9: time taken
`timeUsedSeconds` now subtracts `pausedTotalSeconds`, which ExamControl records when an administrator pauses the clock. Before, a paused student looked slow.

## Not done
No teacher screens (Teacher workstream), no class-level view, no parent reports.
