# Sharing, examination password and locked browser: contract (Workstream 1)
Additive. Separate collections and a separate gate in front of the exam routes; the exam controller, Exam Guard and the finaliser are untouched.

## Collections (new)
`ExamAccess` (one per exam: `listed`, password hash/salt/version, `lockedBrowser{required,browserExamKeys,configKeys}`), `ExamShare` (links), `ShareGrant` (account opened a link), `ExamUnlock` (account entered the exam password, with the password version), `Guest` (name, optional contact; used as the attempt's `userId`).

## Guests
A guest is NOT a User. Their attempts have `userId` = the Guest id, so any code that joins `Attempt.userId` to `User` will find nothing for them (Analytics, Messages): treat a missing user as "guest" and look in `Guest`. Guest tokens are signed with JWT_SECRET with `role:"guest"`, `guest:true`, `eid` (the one exam), `sid` (the link), `pv` (password version). Every other route requires `requireRole(...)` against a real account, so a guest gets 403 there. `/api/auth/me` answers guests from the token (see WIRING step 2d).

## Rules enforced on the existing exam routes (middleware/examAccess.js)
- Guests can use only their one exam and its attempts; never the exam list.
- Link-only exams (`listed:false`) are hidden from the list and unreachable without a live link (or an attempt already in progress).
- Starting needs: Safe Exam Browser (if required), then the exam password (if set; not needed to resume). New starts by guests need the link to still be active.
- Locked browser applies to the whole attempt (`/attempts/:id/...`) except `/result`.
- Examiners (admins) are exempt.

## Password
One per exam, set by the examiner (optionally while building it). Stored as a salted scrypt hash, compared exactly. Changing or removing it bumps `passwordVersion`, so earlier unlocks stop counting for new starts; people already sitting are not interrupted. It is never returned by any endpoint and never written to the audit log.
