const nodemailer = require("nodemailer");

// Sends the OTP email. Which transport is used depends on the environment:
//  1. BREVO_API_KEY (+ EMAIL_FROM)  -> Brevo HTTPS API (works on Render's free plan; SMTP is blocked there)
//  2. EMAIL_USER / EMAIL_PASS       -> Gmail SMTP (local or paid hosts)
//  3. none, and NODE_ENV=development -> prints the code to the server log (development only)
//  4. none, any other environment    -> throws, so a missing provider is reported, never silently ignored.
const sendEmail = async (to, otp) => {
  const subject = "Your iPrime verification code";
  const html = `<h2>Your verification code is: ${otp}</h2><p>It expires in 5 minutes. If you did not request it, ignore this email.</p><p>Prime Excelerate Tutelage</p>`;

  if (process.env.BREVO_API_KEY) {
    if (!process.env.EMAIL_FROM) throw new Error("EMAIL_FROM is required with BREVO_API_KEY");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM, name: "iPrime - Prime Excelerate Tutelage" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) throw new Error(`Brevo responded ${res.status}`);
    return;
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV EMAIL] OTP for ${to}: ${otp}`);
    return;
  }

  throw new Error("No email provider configured");
};

module.exports = sendEmail;
