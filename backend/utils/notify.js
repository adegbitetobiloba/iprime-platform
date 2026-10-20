const { sendMessage } = require("./sendEmail");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const siteUrl = () => (process.env.PUBLIC_SITE_URL || (process.env.CORS_ORIGINS || "").split(",")[0] || "").trim().replace(/\/$/, "");
const link = (path, label) => (siteUrl() ? `<p><a href="${esc(siteUrl() + path)}">${esc(label)}</a></p>` : "");

// Every notice is best-effort: a failed email must never block or undo an approval, so errors are logged (without personal data) and swallowed.
async function safely(label, fn) {
  try { await fn(); return true; } catch (err) { console.error(`${label} email failed:`, err.message); return false; }
}

const notifyApproved = (user) => safely("approval", () => sendMessage(
  user.email, "Your iPrime account has been approved",
  `<h2>Welcome to iPrime, ${esc(user.firstName)}!</h2><p>An administrator has approved your account. You can now log in.</p>${link("/login", "Log in to iPrime")}<p>Prime Excelerate Tutelage<br>The Peak of Academic Excellence and Integrity</p>`
));

const notifyRejected = (user, note) => safely("rejection", () => sendMessage(
  user.email, "About your iPrime registration",
  `<p>Hello ${esc(user.firstName)},</p><p>Your iPrime registration was not approved.${note ? ` Note from the administrator: ${esc(note)}` : ""}</p><p>If you think this is a mistake, please contact Prime Excelerate Tutelage.</p>`
));

// Tells the people listed in ADMIN_EMAILS that someone is waiting. Only counts and the person's name: no private details.
const notifyAdminsNewStudent = (user) => safely("admin alert", async () => {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const to of admins) {
    await sendMessage(to, "A new student is waiting for approval",
      `<p>${esc(user.firstName)} ${esc(user.lastName)} has registered and verified their email. Their account is waiting for your approval.</p>${link("/admin/students?approval=pending", "Review pending students")}`);
  }
});

module.exports = { notifyApproved, notifyRejected, notifyAdminsNewStudent };
