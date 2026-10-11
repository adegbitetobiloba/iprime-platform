# iPrime Platform - project instructions

Product: iPrime, the digital platform for **Prime Excelerate Tutelage** (spelling: Excelerate, one L).
Tagline (exact): "The Peak of Academic Excellence and Integrity".
Focus: JAMB UTME prep, learning library, CBT practice, student / parent / admin portals.
Users are mostly Nigerian students on phones with limited data: mobile-first, light pages, optimised images.

## Layout and commands
- `backend/` Express 5 + Mongoose. `cd backend && npm install && npm run dev | npm test | npm start`.
- `frontend/` React + Vite (to be created). Use `VITE_API_URL` for the API base URL; never hard-code API URLs.
- Health endpoint: `GET /health`.

## Rules
- Never commit secrets (.env, MONGO_URI, JWT_SECRET, API keys). Keep `.env.example` placeholders up to date.
- Never connect to, copy data from, or deploy over any other project (including the FVIC portal).
- Roles: student, parent, teacher, admin. Self-signup is limited to student and parent; admin is created only with `npm run create-admin`.
- Do not log OTPs or passwords. Validate all input with Joi. Keep rate limiting on auth routes.
- Branches: `main` is stable; work on `feature/*` branches and merge through pull requests with CI passing.
- Logo: preserve the approved logo (`brand/logo-master.png`); do not redraw, recolour or change proportions.
- Report only what was actually run or verified.
