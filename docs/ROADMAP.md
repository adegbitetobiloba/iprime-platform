# iPrime roadmap and project state

Last updated: 2026-10-11. Read this first in any new session; do not repeat the audit.

## Architecture (as deployed)

| Part | Technology | Where |
|---|---|---|
| Frontend | React 18 + Vite 5 + React Router 6, plain CSS tokens (`src/styles.css`), no UI or animation libraries | Render **static site** `iprime-web` (https://iprime-web.onrender.com), root `frontend`, publish `dist` |
| Backend | Node + Express 5 + Mongoose 9, JWT (7 days), bcrypt, Joi, rate limiting, helmet | Render **web service** `iprime-api` (free plan, Frankfurt), root `backend`, health `/health` |
| Database | MongoDB Atlas (project `iprime`, own cluster) | `MONGO_URI` is set only in Render |
| Email | Brevo HTTPS API (OTP codes) | `BREVO_API_KEY`, `EMAIL_FROM` set only in Render |
| Source | GitHub `adegbitetobiloba/iprime-platform` (private), branch `main` | auto-deploys: API only when GitHub checks pass |

Netlify is not used. `netlify.toml` in the repo root is unused and can be removed. The FVIC project (`week3-crud-todo-api`, `React_Frontend`, fvicportal) is separate and must not be touched.

Free-plan limits to remember: the API sleeps after about 15 minutes idle and takes up to a minute to wake; the frontend is a static site and does not sleep.

## Audit

**A. Working and verified**
- Public site loads; registration, email OTP verification, login, logout, session persistence (owner tested the live site).
- Render deploys of `iprime-api` and `iprime-web` are live on the latest commits (checked through Render's API).
- Profile editing (`PATCH /api/auth/me`) deployed; owner-side test of saving and reloading is still to be confirmed.

**B. Implemented, not fully verified**
- Automated tests (`npm test`) exist (health, 404, token required, validation, ID format) but have not been seen running in CI. Check the GitHub Actions tab.
- Student IDs (`PET-XXXXXXXX`): generator verified by execution; database assignment not yet tested live.
- Mobile layouts and the new navigation menu: not inspected on real devices.

**C. Partially implemented**
- Roles: student, parent, teacher, admin exist in the model; only student and parent can self-register; no admin dashboard or `create-admin` run yet.
- Public pages exist with honest empty states; contact details, mission, events, announcements and programme details are not yet supplied or editable.

**D. Missing**
Password reset, change password, parent-student linking, programmes/events/announcements data and admin editing, learning library, CBT system, results, admin dashboard, audit trail, file storage, notifications, contact form.

**E. Needs improvement**
Design research with inspected references, real photography or illustrations (licensing), accessibility audit, bundle-size check, lockfile (`package-lock.json`) not committed.

**F. Security and reliability concerns**
- No password reset or change-password flow.
- MongoDB network access is `0.0.0.0/0` (required by Render free plan); keep the database user strong and least-privilege.
- JWT lives in localStorage (acceptable for now; revisit with httpOnly cookies if the threat model grows).
- No audit logging yet; role changes have no UI.
- CI uses `npm install`, not `npm ci`, until a lockfile is committed.

**G. Blocked or external**
- Institution content: contact details, mission/vision, programmes, events (owner must supply).
- Atlas MCP access is disabled for the owner's organisation, so the database cannot be inspected by Claude.
- The GitHub connector can read but not write; code changes are uploaded manually by the owner.
- Licensed photography for the site has not been sourced.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | Deploy, auth, profile editing, docs, tests | Done (tests unconfirmed in CI) |
| 2 Public website | Nav, footer, About, Programmes, Events, News, Contact, FAQ | **Built, awaiting upload** (content pages are honest placeholders) |
| 3 Student experience | Student ID, profile, dashboard | Student ID built; dashboard overview to grow with data |
| 4 Content backend | Programmes, events, announcements, contact settings in MongoDB; admin editing | **Next** |
| 5 Admin dashboard | Admin role setup, user list, content management, audit trail | After 4 |
| 6 Library | Subjects/topics/resources, search, admin management, private storage | After 5 |
| 7 CBT | Tests, attempts, server-side timer and scoring, results | After 6 |
| 8 Parent portal | Secure parent-student linking and views | After 7 |
| 9 Refinement | Accessibility, performance, device testing, security review | Last |

## Exact next action
1. Owner uploads the Phase 4 bundle, confirms CI is green and the site works on a phone.
2. Build Phase 4 (content models + public read endpoints + admin editing), starting with a safe admin bootstrap (`npm run create-admin`).
3. Owner supplies: official contact details, mission and vision, programme details, any real events.

## Decisions and rules
- Preserve working auth; no schema resets; never delete user data.
- Server is authoritative for permissions, timers and scoring.
- No invented content, statistics, testimonials or contact details.
- Student IDs: server-generated, `PET-` + 8 characters, unique index, never edited, never a credential.
- Payments/subscriptions: not started; needs an explicit business decision first.
