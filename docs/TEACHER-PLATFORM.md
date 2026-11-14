# Teacher platform: what exists now

## Who sees what
- /teacher (apply) and /teacher/login are not linked from the public signup or login pages. The public login treats a teacher's email as a wrong password.
- A teacher application is pending until an administrator approves it. Unverified emails cannot be approved. Reject and suspend need a written reason. Every decision is audited and the teacher is emailed.
- Suspending or rejecting takes effect on the teacher's very next request (the server re-reads the account every time).

## Students a teacher can see (one rule, in backend/utils/teacherAccess.js)
1. Individually assigned by an administrator (optionally limited to some subjects), or
2. A subject group: "this teacher looks after every student whose APPROVED enrolment's confirmed subjects include <subject>". It is a rule, so students who are approved later appear automatically and students whose subjects change disappear. A teacher who has a student only through a subject group sees that student's results in that subject only.
Teachers never see contact, payment, guardian, health or address details, and never see answer keys of other people's exams.
Performance numbers come from /api/teacher/analytics (the M10 controller), which now uses the same rule.

## What teachers can create (all start as drafts; teachers can never publish)
- Library materials: written text, PDF, images, web link. Courses: chapters and lessons (text, video link, PDF, web link). Tests and mock exams: details, single questions, or pasted questions.
- They can edit only their own drafts. "Send for review" locks the item until an administrator publishes it or returns it with a note (or the teacher withdraws it).
- Administrators publish through Admin > Teachers > Waiting for review. Publishing runs the SAME checks as the normal admin publish buttons, so an unready course or empty exam is refused with the reason.

## Admin pages
Admin > Teachers: applications and teachers (approve, reject, suspend, reinstate), subject groups (with a live count of how many approved enrolments a rule covers), individual students, and the review queue.

## Not done yet (next build)
- Messenger for teacher-student and teacher-admin chat (a new conversation type beside the existing student-admin one).
- Editing a question after adding it (teachers delete and re-add for now), the question bank for teachers, and a programme filter in the subject-group form (the server already supports it).
