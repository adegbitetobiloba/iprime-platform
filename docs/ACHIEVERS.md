# Student achievements: how they work now

## What is on the website
The Achievements page and the home page show the four scholars from the 2027 JAMB flyer (scores 342, 344, 355 and 362), each with a refined portrait.
The photos are cut from the flyer, upscaled, lightly sharpened, and set on the site's navy background. Faces are not edited. They are only about 170 pixels wide in the flyer,
so ask for the original photographs for a sharper result. Source cutouts are kept in `design-assets/achievers/`.

## Filling in the proper details (admin)
Admin area, Programmes page, scroll to **Student achievements**.
1. First time: press **Add the four scholars from the flyer**. This creates four records you can edit. (Until you do, the website shows the same four from the built-in starter set.)
2. **Edit** a record to add the real name, year, programme attended, evidence reference, and consent flags. A name is optional: blank shows "Prime Excelerate scholar".
3. A person appears only when ALL of these are true: **Show on the website** is on, **verified** is ticked, **consent is "Granted"**, and (for under 18) **guardian consent** is ticked.
   The table says "Visible" or "Hidden: <reason>" for each record.
4. **Withdrawn** consent, **Hide**, or **Archive** removes the person from the website within about 30 seconds.
5. Once any record exists, the website shows ONLY what the server lists, so removing someone in the admin removes them everywhere.

## Things to confirm
- 362 or 361: the award board in the flyer and this flyer say 362 (name written on the board: Bello Jesufolahan Elijah); the other flyer lists "Bello Jesufolahan 361". Check the result slip and edit the score.
- Names for the other three, and the exam year for 342 and 344.
- The evidence reference for each (shown to admins only, never public).
- 355 is recorded as a JAMB (UTME) score, as the owner confirmed. The flyer also calls this person the 2026 Testdriller Challenge winner.

## Adding a new photo
Put the image in `frontend/public/images/achievers/` and add it to `PORTRAIT_FILES` in `frontend/src/achievements.js`; it then appears in the admin's Photo list.
(An upload button would need file-storage work, which is separate.)

## For developers
Backend: `models/Achiever.js`, `controllers/achieverController.js`, `validations/achieverValidation.js`, `utils/achievers.js` (the visibility rule), routes in `adminRoutes.js` (`/api/admin/achievers`) and `publicRoutes.js` (`/api/public/achievements`).
Frontend: `achievements.js` (rules, starter set), `useAchievers.js`, `components/AchievementCard.jsx`, `components/AchieversAdmin.jsx` (mounted in `pages/admin/AdminProgrammes.jsx`).
The server and the browser use the same rule; the public endpoint never returns evidence references or consent flags. No database migration is needed (a new collection).
