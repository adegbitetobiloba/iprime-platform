# M4 Attempt Review + Exam Guard compatibility integration

## Included in this merged package
- Original Exam Guard implementation and its backend/frontend files are retained unchanged except the admin settings page and admin route registry.
- M4 read-only attempt-review controller, list/detail pages, controller tests, and documentation are added.
- `ExamSettings.jsx` keeps all Exam Guard settings and adds the per-exam attempt-review link. **Do not replace it with the standalone M4 version**, because that version removes Exam Guard controls.
- `backend/routes/adminRoutes.js` registers the attempt-review routes after the existing admin authentication/role middleware.

## Required app-shell wiring (not present in the Exam Guard archive)
In `frontend/src/App.jsx`, add:
```jsx
import AdminAttempts from "./pages/admin/AdminAttempts.jsx";
import AdminAttemptReview from "./pages/admin/AdminAttemptReview.jsx";
```
Within the existing admin route group add:
```jsx
<Route path="attempts" element={<AdminAttempts />} />
<Route path="attempts/:id" element={<AdminAttemptReview />} />
```
Ensure these routes remain inside the authenticated admin layout.

The M4 pages import `./builder.css`; that stylesheet and `AdminExamBuilder.jsx` were not in the Exam Guard archive. Keep the existing repository versions. The M4 builder changes described in `WIRING-M4.md` (hide the pool question list for per-student draws and link to attempts) have **not** been applied because the baseline builder file was not supplied in the Exam Guard archive.

## Security compatibility
- Attempt review endpoints are read-only and admin-only under `/api/admin`.
- They do not change attempt state, violation counts, guard snapshots, scores, or submission lifecycle.
- Student-facing endpoints must never expose answer keys from the review controller.
- Do not remove or weaken Exam Guard controls, integrity event collection, attempt submission validation, or lifecycle safeguards.

## Tests
Run from the full backend project:
```bash
node --test backend/test/adminAttempt.test.js backend/test/guard.test.js backend/test/attemptLifecycle.test.js backend/test/lateSync.test.js
```
The included M4 controller test uses the original M4 in-memory database stand-ins. Full project tests and frontend build require the complete repository/dependencies.
