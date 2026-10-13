# Update: 2026-10-12 (evening)

Checked on Render before this change:
- Backend `iprime-api`: live on the commit "feat: CBT, admin area, institution positioning".
- Frontend `iprime-web`: still on the earlier commit "public pages, navigation, student IDs, roadmap". The CBT screens, Exams/Admin links and new wording were not on the live site. This bundle contains the whole frontend so one upload brings it level.

Added in this bundle:
- Signed-in experience fixed everywhere: header (account menu replaces Log in / Sign up), homepage (personalised by role, real data only), footer, and a signed-out homepage with sign-up sections. Session survives refresh; logging out in one tab logs out the others; an expired token signs the user out cleanly.
- Programme management: admin creates and publishes programmes (Admin -> Programmes); they appear on the homepage, About page and Programmes page. Nothing is pre-filled. Backend: `GET /api/public/programmes` (published only), `/api/admin/programmes` (admin only).
- Photo slots with graceful fallbacks (`docs/IMAGES.md`).

Tested here: 33 browser checks of the signed-in/out experience, 18 of the exam screen, all pages render, 9 logic tests. Not tested: the new programme endpoints against a real database, and the deployed site.
