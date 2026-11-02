# M4: examiner attempt review + hide the question list for per-student draws
Do this in one branch. Frontend plus one new backend controller. No schema change, no new packages.

## Step 1: upload these files (same paths as the zip)
BACKEND new: `controllers/adminAttemptController.js`, `test/adminAttempt.test.js`
FRONTEND new: `src/pages/admin/AdminAttempts.jsx`, `src/pages/admin/AdminAttemptReview.jsx`
FRONTEND replace (check size on GitHub first; if it differs from the number in brackets, STOP and tell me): `src/pages/admin/AdminExamBuilder.jsx` [31885 bytes], `src/components/ExamSettings.jsx` [7723], `src/pages/admin/builder.css` [6109]
Also add `docs/ATTEMPT-REVIEW.md`.

## Step 2: two small hand edits (be careful with brackets; paste each line exactly)
### 2a. backend/routes/adminRoutes.js
1. Directly under the line `const bankC = require("../controllers/bankController");` add:
   `const attemptsC = require("../controllers/adminAttemptController");`
2. Directly under the line `router.post("/bank/select", validate(bankV.select), bankC.select);` add these two lines:
   `router.get("/attempts", attemptsC.list);`
   `router.get("/attempts/:id", attemptsC.detail);`
   (They must stay below the `router.use(protect, requireRole("admin"))` line, as the bank routes are, so only admins can reach them.)
### 2b. frontend/src/App.jsx
1. Directly under the line `import AdminExamBuilder from "./pages/admin/AdminExamBuilder.jsx";` add:
   `import AdminAttempts from "./pages/admin/AdminAttempts.jsx";`
   `import AdminAttemptReview from "./pages/admin/AdminAttemptReview.jsx";`
2. Directly under the line `<Route path="exams/new" element={<AdminExamBuilder />} />` add:
   `<Route path="attempts" element={<AdminAttempts />} />`
   `<Route path="attempts/:id" element={<AdminAttemptReview />} />`
After editing, open the file's diff before committing: every line you added must start with `import` or `<Route` and end with `;` or `/>`. A missing bracket fails the whole build.

## Where examiners find it
- Open an examination: below its settings there is now a link "View student attempts for this examination".
- Direct addresses: `/admin/attempts` (all attempts, with search and filters) and `/admin/attempts/<attempt id>`.
- The admin sidebar now has no "Attempts" entry because that menu is owned by the Frontend chat and changed recently. Ask them to add one link to `/admin/attempts`.

## What changed in the builder
When "Give each student their own different questions" is on, the builder no longer lists the questions. It shows the counts and breakdown only, with "Show the pool's questions" if you do want to look. The same choice is now on the Questions step (not only in Settings), with the live explanation of how different the papers will be and a button to use all available questions as the pool.

## What was verified (my sandbox, 2 Nov)
- Backend 112 of 112 tests pass; frontend 51 pass, 1 skipped (real PDF).
- The real controller was run over in-memory data and its output rendered by the real pages in Chromium: list, search, filters, the exact questions one student was given (6 from a pool of 30), their answers against the correct ones, the letters they saw, Wrong/Unanswered filters, an in-progress attempt. No browser errors. I broke the controller on purpose (showing the whole pool instead of the student's own questions) and 3 tests failed, then passed again once restored.
- Searching is safe: a search for `.*` is treated as text.
NOT verified: Joi, `vite build`, real MongoDB, the real router/auth and the site's own CSS and sidebar.

## Smoke test
1. As admin, open Examinations, open a published pool exam, click "View student attempts".
2. Have two students take it. Both appear in the list; "Own draw of questions" shows under the exam name.
3. Open each: the questions differ, and each shows the student's answer and the correct one. The letters match what that student saw.
4. Search by a student's name or student ID; filter by "In progress".
5. In Build from question bank, tick "Give each student their own different questions": the question list is hidden; "Show the pool's questions" reveals it.
Send me anything odd: the step, the message on screen, and the browser console error.
