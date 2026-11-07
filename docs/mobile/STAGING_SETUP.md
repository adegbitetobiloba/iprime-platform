# Staging setup (Account 6, B1) — phone + Codespace

Goal: a second, separate copy of the API for mobile testing. Production is never touched by any step below.
Cost: $0 on free plans. Nothing here needs a secret to be shared with anyone. Secrets are typed only into Render, Atlas or the Codespace terminal.

Status of this guide: written, NOT yet run. Steps marked (verify) rely on dashboards I could not see.

## Part 1. Branch and files (Codespace terminal)
```
git fetch origin
git checkout main && git pull
git checkout -b staging
git push -u origin staging
git checkout -b stream-6/b1-staging
```
Upload `iprime-account6-B1.zip` to the repo root, then:
```
unzip iprime-account6-B1.zip
git add backend/scripts/seedStaging.js docs/mobile
git commit -m "B1: staging seed script and setup docs"
git push -u origin stream-6/b1-staging
```
Open a Pull Request with **base = staging** (not main). Check the "base" box before pressing Create. Only you merge.

## Part 2. Atlas (separate project)
1. cloud.mongodb.com, Projects, New Project, name `iprime-staging`.
2. Create a free cluster (M0), same region family as production.
3. Database Access: add a user `iprime_staging_app` with a strong password, privilege **readWrite on database `iprime_staging` only**.
4. Network Access: allow `0.0.0.0/0` (Render free has no fixed IP; the strong password and the single-database user are the protection).
5. Connect, Drivers, copy the string, and put `/iprime_staging` after the host and before the `?`. The database name MUST end with `_staging` or the seed script refuses to run.

## Part 3. Render (a normal Web Service, NOT a Blueprint, so `render.yaml` and production are untouched)
New, Web Service, pick `iprime-platform`, then:
- Name: `iprime-api-staging`
- Branch: **staging**
- Root Directory: `backend`
- Build Command: `npm install` · Start Command: `node app.js`
- Region: Frankfurt (same as production) · Instance type: **Free**
- Health Check Path: `/health`
- Auto-Deploy: **On Commit** (CI does not run on pushes to `staging`, so "After CI checks pass" may never fire) (verify)

Environment variables:
- `NODE_ENV` = `production`
- `MONGO_URI` = the staging string from Part 2
- `JWT_SECRET` = a different long random value from production (48+ characters; Render can generate one)
- `CORS_ORIGINS` = `http://localhost:5173` (required in production mode; the native app sends no Origin)
- Do NOT add `BREVO_API_KEY` or `EMAIL_FROM` (shares production's email quota). Test accounts come from the seed script.

Check: open `https://<your-staging-service>.onrender.com/health`. It can take about a minute the first time. Expect `{"status":"ok","db":true,"commit":"xxxxxxx"}`.

## Part 4. Seed test data (Codespace; Render free has no shell)
```
cd backend
npm install
STAGING_SEED=yes SEED_PASSWORD='choose-a-long-passphrase' MONGO_URI='<staging string>' node scripts/seedStaging.js
```
It prints the test emails (not the password). It creates: 1 admin, 2 students, 1 parent (unlinked), 1 published 10-question exam, 1 published course with 2 lessons. Safe to run again.
Never paste the connection string or passphrase into a chat or a file in Git. Never create `.env` with the staging string inside a folder you commit.

## Part 5. Smoke test
```
curl -s https://<staging-url>/health
curl -s -X POST https://<staging-url>/api/auth/login -H 'Content-Type: application/json' -d '{"email":"staging.student1@example.com","password":"<your SEED_PASSWORD>"}'
```
The second should return JSON containing `token` and a `user` with role `student`. Do not share the token. Tell Account 6 only "worked" or the error text.

## Part 6. Tell the others
The staging URL is not a secret. Give it to Account 1 for the staging value in `mobile/eas.json`. Production stays as it is.

## Rules while staging exists
- Do not ping staging to keep it awake (free hours are shared across the Render workspace; a sleeping service uses none).
- Never copy production data into staging.
- Merge into `staging` first; merge into `main` only after the owner approves, because `main` deploys to production.

## Rollback (removes everything this guide created)
1. Render: staging service, Settings, Delete Web Service.
2. Atlas: delete the `iprime-staging` project (or drop `iprime_staging` in Browse Collections).
3. GitHub: `git push origin --delete staging` and delete branch `stream-6/b1-staging`.
Production is unaffected by all three.
