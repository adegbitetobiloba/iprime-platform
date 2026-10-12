# iPrime Platform - project instructions

Product: iPrime, the digital platform for **Prime Excelerate Tutelage** (spelling: Excelerate, one L).
Tagline (exact): "The Peak of Academic Excellence and Integrity".
Positioning: the institution prepares students, improves academic performance and brings out the best in every student across different classes, subjects and examinations. It is NOT only a JAMB UTME school: never describe it as JAMB-only, and do not invent programmes, classes or services that the institution has not confirmed. Scope: learning library, CBT, student / parent / admin portals.
Users are mostly Nigerian students on phones with limited data: mobile-first, light pages, optimised images.

## Layout and commands
- `backend/` Express 5 + Mongoose. `cd backend && npm install && npm run dev | npm test | npm start`.
- `frontend/` React + Vite (to be created). Use `VITE_API_URL` for the API base URL; never hard-code API URLs.
- Health endpoint: `GET /health`.

## Rules
- Never commit secrets (.env, MONGO_URI, JWT_SECRET, API keys). Keep `.env.example` placeholders up to date.
- Never connect to, copy data from, or deploy over any other project (including the FVIC portal).
- Roles: student, parent, teacher, admin. Self-signup is limited to student and parent. Admins are created only by listing a verified email in the server's `ADMIN_EMAILS` variable (or `npm run create-admin`). The server checks the role on every protected request; the frontend only hides links.
- CBT: the server is authoritative for the deadline, saved answers and scoring. Correct answers and explanations must never be sent to students while an attempt is in progress. Read `docs/CBT.md` before changing it.
- Do not log OTPs or passwords. Validate all input with Joi. Keep rate limiting on auth routes.
- Branches: `main` is stable; work on `feature/*` branches and merge through pull requests with CI passing.
- Logo: preserve the approved logo (`brand/logo-master.png`); do not redraw, recolour or change proportions.
- Report only what was actually run or verified.
