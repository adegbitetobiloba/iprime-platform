const { sendMessage } = require("./sendEmail");

// Teacher-related emails. Kept in its own file so the existing student notices (utils/notify.js) are left exactly as they are.
// Every notice is best-effort: a failed email must never block or undo an approval, so errors are logged (without personal data) and swallowed.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const siteUrl = () => (process.env.PUBLIC_SITE_URL || (process.env.CORS_ORIGINS || "").split(",")[0] || "").trim().replace(/\/$/, "");
const link = (path, label) => (siteUrl() ? `<p><a href="${esc(siteUrl() + path)}">${esc(label)}</a></p>` : "");

async function safely(label, fn) {
  try { await fn(); return true; } catch (err) { console.error(`${label} email failed:`, err.message); return false; }
}

const notifyAdminsNewTeacher = (user) => safely("teacher admin alert", async () => {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const to of admins) {
    await sendMessage(to, "A teacher application is waiting for review",
      `<p>${esc(user.firstName)} ${esc(user.lastName)} has applied for a teacher account and verified their email. Please review the application.</p>${link("/admin/teachers?status=pending", "Review teacher applications")}`);
  }
});

const notifyTeacherApproved = (user) => safely("teacher approval", () => sendMessage(
  user.email, "Your iPrime teacher account is active",
  `<h2>Welcome, ${esc(user.firstName)}!</h2><p>An administrator has approved your teacher account. You can now sign in to the teacher area.</p>${link("/teacher/login", "Teacher sign in")}<p>Prime Excelerate Tutelage</p>`
));

const notifyTeacherRejected = (user, note) => safely("teacher rejection", () => sendMessage(
  user.email, "About your iPrime teacher application",
  `<p>Hello ${esc(user.firstName)},</p><p>Your teacher application was not approved.${note ? ` Note from the administrator: ${esc(note)}` : ""}</p><p>If you think this is a mistake, please contact Prime Excelerate Tutelage.</p>`
));

const notifyTeacherSuspended = (user, note) => safely("teacher suspension", () => sendMessage(
  user.email, "Your iPrime teacher account has been suspended",
  `<p>Hello ${esc(user.firstName)},</p><p>Your teacher account has been suspended and you cannot sign in for now.${note ? ` Note from the administrator: ${esc(note)}` : ""}</p><p>Please contact Prime Excelerate Tutelage if you have questions.</p>`
));

// A teacher's library submission was published or sent back.
const notifyTeacherMaterial = (user, title, outcome, note) => safely("teacher material", () => sendMessage(
  user.email, outcome === "published" ? "Your library material is published" : "Your library material needs changes",
  `<p>Hello ${esc(user.firstName)},</p><p>${outcome === "published" ? `"${esc(title)}" has been published to the iPrime library.` : `"${esc(title)}" was returned to you for changes.${note ? ` Note from the administrator: ${esc(note)}` : ""}`}</p>${link("/teacher/library", "Open your library materials")}`
));

module.exports = { notifyAdminsNewTeacher, notifyTeacherApproved, notifyTeacherRejected, notifyTeacherSuspended, notifyTeacherMaterial };
