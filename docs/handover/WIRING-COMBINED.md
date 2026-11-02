# Combined build: exam guard + M4 attempt review + Library v4

One zip, three folders: `backend`, `frontend`, `docs`. Upload by dragging the folders; same-named files are replaced.

## Already done inside this zip (you do not repeat them)
- `backend/routes/adminRoutes.js`: the two M4 edits are already applied (the `attemptsC` require and the `/attempts` and `/attempts/:id` routes). This file is the exam-guard version, so it also carries the `/integrity` mount.
- `frontend/src/components/ExamSettings.jsx`: exam-guard version (security settings) plus M4's "View student attempts" link. The M4 zip and the guard zip each had their own copy; this is both combined.

## Check before uploading (file sizes on GitHub)
M4 and the guard build were each made from a different copy of `ExamSettings.jsx`, `AdminExamBuilder.jsx` and `builder.css`. M4 asked you to confirm the current sizes on GitHub first: ExamSettings 7723 bytes, AdminExamBuilder 31885, builder.css 6109. If they differ, stop and tell me.
`ExamRunner.jsx`, `examController.js`, `Attempt.js`, `Exam.js`, `cbtValidation.js`, `cbtRoutes.js` (guard) replace your current files.

## One hand edit left: frontend/src/App.jsx
Add under the existing imports:
    import AdminAttempts from "./pages/admin/AdminAttempts.jsx";
    import AdminAttemptReview from "./pages/admin/AdminAttemptReview.jsx";
    import LibraryShelf from "./pages/LibraryShelf.jsx";
Add under `<Route path="exams/new" element={<AdminExamBuilder />} />`:
    <Route path="attempts" element={<AdminAttempts />} />
    <Route path="attempts/:id" element={<AdminAttemptReview />} />
Add with the other student routes:
    <Route path="/library/shelf" element={<Protected><LibraryShelf /></Protected>} />
If missing (Library v3): /library/utme, /library/materials, /library/materials/:id.
Check the diff before committing: each added line starts with `import` or `<Route` and ends with `;` or `/>`.

## Not in this zip (it never was in any of the three)
Library v4 builds on v3: the v3 files, and the lines mounting the library routes in the server, must already be in your repo.
Models/files from the repo that the tests need (`utils/randomise`, `utils/cbt`, `utils/pool`) also live in your repo, not here.

## Docs
- `docs/EXAM-GUARD-AND-OFFLINE.md`, `docs/ATTEMPT-REVIEW.md`
- `docs/handover/`: WIRING-M4.md, UPDATE.md (Library v4), LIBRARY_ROADMAP.md, and the Library feature specification.
- Library syllabus review notes: `backend/data/UTME_SYLLABI_REVIEW.md` (unchanged location).
