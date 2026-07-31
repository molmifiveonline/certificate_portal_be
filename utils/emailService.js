const nodemailer = require("nodemailer");
const db = require("../config/db");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const injectDisclaimer = (html) => {
  const disclaimer = `<div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px; font-family: Arial, sans-serif; color: #856404; font-size: 14px;"><strong>⚠️ PLEASE IGNORE:</strong> This email is generated for internal review purposes only. Please ignore this email; no action is required.</div>`;
  
  if (html.includes("<body")) {
    return html.replace(/(<body[^>]*>)/i, `$1${disclaimer}`);
  }
  if (html.trim().startsWith("<div")) {
    return html.replace(/(<div[^>]*>)/i, `$1${disclaimer}`);
  }
  return disclaimer + html;
};

const sendEmail = async (to, subject, html) => {
  try {
    // TEMPORARY TESTING: Intercept emails to trainers
    if (to) {
      const [users] = await db.query(
        "SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?",
        [to]
      );
      if (users.length > 0 && users[0].role_name === "trainer") {
        console.log(`[TESTING] Intercepted email to trainer (${to}). Email was not sent.`);
        return { messageId: "intercepted-trainer-email" };
      }
    }

    const finalSubject = `[PLEASE IGNORE] ${subject}`;
    const finalHtml = injectDisclaimer(html);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: finalSubject,
      html: finalHtml,
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendEmail };
