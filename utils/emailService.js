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

const sendEmail = async (to, subject, html) => {
  try {
    let finalHtml = html;

    // Temporarily check if the recipient email belongs to a candidate or trainer
    try {
      const [rows] = await db.query(
        `SELECT r.name FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.email = ?`,
        [to]
      );
      if (rows.length > 0) {
        const roleName = rows[0].name.toLowerCase();
        if (roleName === "candidate" || roleName === "trainer") {
          const testText = "<br><br><p style='color: red; font-weight: bold;'>test mail do not reply</p>";
          finalHtml = html + testText;
        }
      }
    } catch (dbError) {
      console.error("Failed to query user role for email testing text:", dbError);
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
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
