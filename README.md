# iPrime Platform

Digital platform for **Prime Excelerate Tutelage** - *The Peak of Academic Excellence and Integrity*.

Prime Excelerate Tutelage prepares students, improves their academic performance and brings out the best in every student, across classes, subjects and examinations.

Scope: public website, student / parent / administrator portals, learning library, computer-based tests (CBT) and academic performance tracking. See `docs/ROADMAP.md` for what is built and what is next.

## Repository layout

| Path | Contents | Status |
|---|---|---|
| `backend/` | Node.js + Express + MongoDB API (auth with email OTP, roles, health check) | Scaffolded |
| `frontend/` | React (Vite) app | Not started |
| `brand/` | Master logo file | Provided |
| `docs/SETUP.md` | Step-by-step setup, deployment and environment variables | Written |
| `render.yaml` | Render Blueprint for the backend | Written, not yet deployed |
| `netlify.toml` | Netlify build and SPA routing for the frontend | Written, not yet deployed |

## Quick start (backend)

```bash
cd backend
npm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
# edit .env: set MONGO_URI and JWT_SECRET (see docs/SETUP.md)
npm run dev              # http://localhost:3000/health
npm test
```

## Security rules

- Never commit `.env` files, database URLs, JWT secrets, API keys or tokens. Use `.env.example` placeholders only.
- iPrime has its own database, backend and deployments, separate from every other project.
- OTP codes are never logged outside `NODE_ENV=development`.

See `docs/SETUP.md` for deployment and `CLAUDE.md` for contributor conventions.
