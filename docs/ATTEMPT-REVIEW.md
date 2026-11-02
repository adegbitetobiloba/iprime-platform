# Examiner attempt review: contract (Workstream 1)
Admin only (same guard as the rest of /api/admin). Read-only.

## GET /api/admin/attempts?exam=&status=&q=&page=&limit=
`exam` = exam id; `status` = in_progress | submitted; `q` = text matched against student first name, last name, email, student ID (case-insensitive, treated as text, not a pattern); `limit` is clamped to 1-50.
Response: `{ total, page, pages, limit, attempts[{ id, student{id,name,studentId,email}, exam{id,title,subject}, status, startedAt, submittedAt, autoSubmitted, answered, drawn, questionCount, score, totalMarks, percentage, correct, incorrect, unanswered }] }`.
`drawn` is true when the student was given their own draw from a question pool.

## GET /api/admin/attempts/:id
The paper THIS student was given, in the order and with the letters they saw (question and option shuffling reproduced from the attempt's own seed):
`{ attempt{ id,status,startedAt,deadline,submittedAt,autoSubmitted,timeUsedSeconds,score,totalMarks,percentage,correct,incorrect,unanswered,shuffledQuestions,shuffledOptions }, student{...}, exam{ id,title,subject,poolSize,questionsPerStudent }, drawn, questions[{ id,text,textHtml?,options[{key,label,text,html?}],marks,yourChoice,yourLabel,correctKey,correctLabel,explanation,explanationHtml?,explanationSource,answered,correct(true|false|null),flagged,topic,subject,difficulty,optionsReordered }] }`
`key` is the option's stored identity; `label` is the letter the student saw. Contains answer keys: never expose to students.

## Notes for other workstreams
- This shows only what is stored on the attempt. It does not recompute scores.
- Tutors/examiners who are not admins cannot use it yet: that needs the class/tutor assignment contract from the Admin workstream (a tutor must only see their own classes).
- Viewing an attempt is not yet written to the audit log (the audit helper's signature was not available to me); Admin should add `attempt.viewed` there.
