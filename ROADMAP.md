# iPrime roadmap and project state

Last updated: 2026-10-12. Read this first in any new session; do not repeat the audit.

## Positioning
Prime Excelerate Tutelage prepares students, improves their academic performance and brings out the best in every student across different classes, subjects and examinations. It is not a JAMB-only institution. Do not invent programmes, classes or services; they must be entered by an administrator once confirmed.

## Architecture (as deployed)
| Part | Technology | Where |
|---|---|---|
| Frontend | React 18 + Vite 5 + React Router 6, plain CSS tokens, no UI/animation libraries | Render static site `iprime-web` (root `frontend`, publish `dist`) |
| Backend | Node + Express 5 + Mongoose 9, JWT, bcrypt, Joi, helmet, rate limiting | Render web service `iprime-api` (free plan, Frankfurt, root `backend`, health `/health`) |
| Database | MongoDB Atlas (project `iprime`) | `MONGO_URI` only in Render |
| Email | Brevo HTTPS API | `BREVO_API_KEY`, `EMAIL_FROM` only in Render |
| Source | GitHub `adegbitetobiloba/iprime-platform` (private), `main` | owner uploads files through the GitHub website; API auto-deploys only when checks pass |

Netlify is not used (`netlify.toml` is unused). FVIC projects are separate: never touch them. Free plan: the API sleeps after ~15 minutes idle (first request up to a minute).

Environment variables on `iprime-api`: `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGINS`, `NODE_ENV`, `BREVO_API_KEY`, `EMAIL_FROM`, and (new) `ADMIN_EMAILS`.

## Status
| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | Deploy, auth, OTP email, profile editing | Done and used |
| 2 Public site and positioning | Pages, nav, footer, institution-wide wording (not JAMB-only) | Built; awaiting upload (this bundle) |
| 3 Registration improvements | Multi-step form, enrolment choices, expectations, referral, study preferences, guardian info, consent | **Blocked: needs the paper form image (it was not attached) and the confirmed programme list** |
| 4 CBT foundation | Exams, questions, attempts, server timer, scoring, results, history, admin exam management, paste import | **Built; awaiting upload and live testing** (logic and exam screen tested here with simulated data; backend endpoints not run against a database) |
| 5 Admin portal | Secure admin provisioning, layout, exam management done; students, programmes, resources, events, announcements still to do | Started |
| 6 Parent portal | Parent-student linking (admin approval workflow), parent dashboard | Not started; needs a data model first |
| 7 Integration | End-to-end tests on the live site, accessibility, performance, security review | After the above |

## Verified in this session
- Exam logic (scoring, deadlines, question parsing, no answers leaked): 9 automated tests, run and passing.
- Student ID generator: 20,000 IDs unique and well-formed.
- Exam screen in a real browser (Chromium) against a simulated server: 18 of 18 checks passed (timer from server deadline, refresh resumes, failed saves reported and retried, device clock cannot add time, auto-submit at zero, confirmation summary, palette, no sideways scroll at 375px, tap targets).
- All 24 pages render without errors (server-side render check).
- NOT verified: the new backend endpoints against a real MongoDB, deployed behaviour on Render, admin screens in a browser, real phones.

## Next actions
1. Owner uploads this bundle, sets `ADMIN_EMAILS` in Render, logs in again, and runs the first real test: create exam -> publish -> take as student -> submit -> check result and history.
2. Owner supplies: the paper registration form image, the list of programmes/classes/subjects actually offered, contact details, mission and vision wording, and the sample textbooks/questions.
3. Then: Phase 3 (registration), programme/class/subject management (admin), then parent linking.

## Rules
- Preserve working auth; no schema resets; never delete user data.
- The server is authoritative for permissions, timers and scoring.
- No invented content, statistics, testimonials or contact details.
- Student IDs: server-generated `PET-` + 8 characters, unique, never edited, never a credential.
- Sensitive data (health, special learning needs) is not collected by default; ask the institution what is legitimately needed first.
- Payments/subscriptions: not started; needs an explicit business decision.
