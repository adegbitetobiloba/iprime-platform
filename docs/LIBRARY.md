# iPrime Library: stages 1 to 5

Owner: workstream 4 (Library / Learning). Built against main @ bbdd80a (2026-10-31 04:45 UTC).
Install: see PATCH.md (a handful of one-line additions to shared files). Everything else in this bundle is a NEW file.

## IMPORTANT: upload with folders intact
`backend/Course.js`, `backend/adminLibraryController.js`, `backend/library.js` etc. already sit FLAT in the repo's backend/ root
(an earlier upload lost the folders). They are not wired in and do nothing there. Upload this bundle by dragging the `backend` and
`frontend` FOLDERS (not the files inside them), or use git/GitHub Desktop. After the correct files are in place, delete the misplaced flat
copies of: Course.js, CourseModule.js, Lesson.js, Subject.js, adminLibraryController.js, adminLibraryRoutes.js, library.js, library.test.js,
libraryProgress.js, libraryValidation.js (backend root only).

## What exists
Backend (new files): models Subject/Course/CourseModule/Lesson + LibraryProgress/LibraryEnrolment/LibraryBookmark/LibraryNote (collections prefixed "library"),
admin API /api/admin/library/*, student API /api/library/*, pure rules in utils/library.js and utils/libraryProgress.js, 11 unit tests.
Frontend (new files): Library home with search, course page, lesson viewer (video, written, external link), saved lessons, notes, bookmarks,
resume, admin course editor, admin analytics, dashboard card.

## Student API (/api/library, student or admin)
GET /home, /courses?subject=&tag=&difficulty=, /search?q=, /courses/:slug, /bookmarks, /me/summary
POST /courses/:id/enrol, /lessons/:id/practice-check, /lessons/:id/bookmark; DELETE /lessons/:id/bookmark
PUT /lessons/:id/progress, /lessons/:id/note
Admins can open unpublished content as a preview; previews create no progress, bookmarks or notes.

## Rules
- A lesson completes only by rule: video 90% watched, written lesson read to the end for half its estimated time, external resource confirmed by the student,
  optional practice exam pass (50%, read from the student's own submitted attempts). Opening never completes. Completion is never revoked.
- Watched time is limited by real elapsed time so one request cannot claim a whole video. This is a soft guard, not proof.
- Exams and questions are only read. Practice links store an exam id; no question is copied. Answers are never selected.
- Written lessons are plain text rendered by a safe renderer that never injects HTML.

## Known limits (honest)
- PDF reader and private storage are NOT built: PDF lessons are refused (501) until storage is chosen. No download button exists anywhere.
- Maths shows subscripts/superscripts only. Fractions and roots need the KaTeX package.
- Vimeo/YouTube tracking depends on those players' scripts loading in the student's browser.
- Practice is linked per lesson to a whole exam; there is no topic-filtered question picker (that belongs to the exam workstream).
- Access is "any signed-in student". Enrolment/payment entitlements from the admin workstream are not applied yet; add them in libraryController.loadLesson when that contract exists.

## Verified
`node --test`: 11/11 pass (pure rules). All backend files pass `node --check`.
NOT verified: any code that needs MongoDB, Express running, or a browser. No React file has been compiled or run (no build tools here).
Run `npm test`, `npm run build` in frontend, and the 9-step admin-to-student walk-through on a branch before merging.
