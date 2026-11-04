// Email to a student when the office confirms their payment. Best-effort; contains no amounts or references.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const siteUrl = () => (process.env.PUBLIC_SITE_URL || (process.env.CORS_ORIGINS || "").split(",")[0] || "").trim().replace(/\/$/, "");
const send = (...a) => require("./sendEmail").sendMessage(...a);

const notifyPaymentConfirmed = async (user) => {
  if (!user || !user.email) return false;
  try {
    await send(user.email, "Your payment has been confirmed",
      `<p>Hello ${esc(user.firstName)},</p><p>The office has confirmed your payment. You can now open and complete your student registration form on iPrime.</p>${siteUrl() ? `<p><a href="${esc(siteUrl())}/enrolment">Open your enrolment</a></p>` : ""}<p>Prime Excelerate Tutelage</p>`);
    return true;
  } catch (err) { console.error("payment email failed:", err.message); return false; }
};

module.exports = { notifyPaymentConfirmed };
