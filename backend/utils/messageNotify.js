// Email alerts for messages. Best-effort: a failed email must never block or undo a message. No message text is ever emailed.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const siteUrl = () => (process.env.PUBLIC_SITE_URL || (process.env.CORS_ORIGINS || "").split(",")[0] || "").trim().replace(/\/$/, "");
const link = (path, label) => (siteUrl() ? `<p><a href="${esc(siteUrl() + path)}">${esc(label)}</a></p>` : "");
const enabled = () => String(process.env.MESSAGE_EMAILS ?? "on").toLowerCase() !== "off";
const send = (...a) => require("./sendEmail").sendMessage(...a); // loaded on use so tests can replace it

async function safely(label, fn) {
  try { await fn(); return true; } catch (err) { console.error(`${label} email failed:`, err.message); return false; }
}

// To the student. Call only when it is their first unread message, so one burst of messages sends one email.
const notifyStudentNewMessage = (student) => !enabled() || !student || !student.email || student.isVerified === false ? Promise.resolve(false) : safely("message", () => send(
  student.email, "You have a new message from Prime Excelerate Tutelage",
  `<p>Hello ${esc(student.firstName)},</p><p>The Prime team has sent you a message on iPrime.</p>${link("/messages", "Open your messages")}<p>Prime Excelerate Tutelage</p>`
));

// To the people listed in MESSAGE_NOTIFY_EMAILS (comma separated). Does nothing when that setting is empty.
const notifyAdminsNewMessage = (studentName) => safely("admin message", async () => {
  if (!enabled()) return;
  const to = (process.env.MESSAGE_NOTIFY_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (const addr of to) await send(addr, "A student has sent a message", `<p>${esc(studentName)} has sent a message to the administration team.</p>${link("/admin/messages", "Open messages")}`);
});

module.exports = { notifyStudentNewMessage, notifyAdminsNewMessage };
