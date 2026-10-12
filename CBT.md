# CBT (computer-based tests): how it works

## Rules the code enforces (server side)
- Only students and admins can use the exam endpoints; admin endpoints need the `admin` role, re-read from the database on every request.
- When a student starts, the server fixes `deadline = start + duration`. The browser only displays a countdown derived from it (corrected by the server's clock), so a refresh or a wrong device clock cannot add time.
- A save is applied only if the attempt is still in progress and the deadline has not passed, checked inside the database update itself.
- Only one attempt can be in progress per student per exam (unique index). Starting again resumes it.
- Submitting (by the student or automatically when time is up) scores on the server. Submitting twice returns the same stored result.
- Correct answers and explanations are never sent while an attempt is running. After submission they are shown only if the exam has "Let students review the correct answers" switched on.
- Questions are locked once an exam is published or has any attempts, so scores cannot change under students.
- A student can read only their own attempts and results (other people's get "not found").

## API
Student: `GET /api/exams`, `GET /api/exams/:id`, `POST /api/exams/:id/start`, `GET /api/attempts`, `GET /api/attempts/:id`, `PUT /api/attempts/:id/answers`, `POST /api/attempts/:id/submit`, `GET /api/attempts/:id/result`.
Admin: `/api/admin/exams` (list, create), `/api/admin/exams/:id` (get, patch, delete), `.../questions` (add, import, update, delete), `.../publish`, `.../unpublish`, `.../attempts`.

## Becoming an administrator
1. Register and verify an account with the email address you want to use.
2. In Render, open `iprime-api` -> Environment and set `ADMIN_EMAILS` to that address (comma-separate several). Save; Render redeploys.
3. Log out and log in again. The Admin link and dashboard appear. Removing an address from the list does not demote an existing admin automatically.

## Creating a test
Admin -> Examinations -> New examination -> add questions one by one, or paste several using:

```
Q: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
Explanation: optional
Marks: optional
Topic: optional
```
Every question needs an explicit `Answer:` line. If any question has a problem, nothing is imported and each problem is listed. Then press Publish.

## Known limits
- Questions live inside their exam (no shared question bank yet).
- Only multiple-choice (A to E) questions; no images or diagrams yet.
- If a student taps two options for one question within milliseconds and the network reorders the requests, the earlier tap could win on the server; the screen shows what was last chosen locally.
- No rate limiting on the answer-saving endpoint yet.
- Result release is on or off per exam; no scheduled release time.
