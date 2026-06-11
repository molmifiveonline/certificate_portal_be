const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} = require("docx");
const {
  getAssessmentResultTemplate,
  getAssessmentCreationTemplate,
  getCertificateGenerationTemplate,
  getFeedbackRequestTemplate,
  getReimbursementApprovedTemplate,
  getReimbursementDisapprovedTemplate,
  getReimbursementResubmissionTemplate,
} = require("../utils/emailTemplates");

const rootDir = path.join(__dirname, "..");
const outputDir = path.join(rootDir, "docs");
const generatedDir = path.join(rootDir, "generated");
const tempDir = path.join(generatedDir, "temp", "email-template-screenshots");
const outputPath = path.join(outputDir, "email-template-screenshots.docx");
const year = 2026;

const sample = {
  candidateName: "Rahul Sharma",
  candidateNameFull: "Mr. Rahul Kumar Sharma",
  trainerName: "Captain Arvind Mehta",
  nominatorName: "Priya Nair",
  adminName: "Amit Patel",
  candidateEmail: "rahul.sharma@example.com",
  adminEmail: "amit.patel@example.com",
  courseName: "Basic Maritime Safety Training",
  assessmentTitle: "Post Course Final Assessment",
  certificateNo: "MOLMI/BMST/2026/001",
  claimNumber: "RC-00042",
  amount: "INR 12,500",
  portalUrl: "https://certificate.molmi.info/index.php/",
  frontendUrl: "https://certificate.molmi.info",
  resetLink: "https://certificate.molmi.info/reset-password?id=1001",
  approveLink: "https://certificate.molmi.info/acknowledge?token=sample-token&action=approve",
  rejectLink: "https://certificate.molmi.info/acknowledge?token=sample-token&action=reject",
  nominationLink: "https://certificate.molmi.info/nominate/sample-token",
  candidateApprovalLink: "https://certificate.molmi.info/candidate-approval/sample-token",
  zoomLink: "https://zoom.us/j/1234567890",
};

const pageShell = (body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { font-family: Arial, sans-serif; color: #111827; }
    .email-frame { width: 720px; padding: 24px; box-sizing: border-box; }
    table { max-width: 100%; }
    a { color: #0b63ce; }
  </style>
</head>
<body>
  <div class="email-frame">${body}</div>
</body>
</html>`;

const fullHtml = (html) => (/^\s*<html[\s>]/i.test(html) ? html : pageShell(html));

const formatDate = (value, type = "none") => {
  if (!value) return "-";
  const [yyyy, mm, dd] = value.split("-");
  if (type === "start") return `${dd}-${mm}-${yyyy}, 00:00`;
  if (type === "end") return `${dd}-${mm}-${yyyy}, 23:59`;
  return `${dd}-${mm}-${yyyy}`;
};

const candidateRegistrationTemplate = ({ isSelfRegistration }) => {
  const accountInfoHtml = isSelfRegistration
    ? `
      <div class='info'>
        <p><strong>Email Address:</strong> ${sample.candidateEmail}</p>
        <p><strong>Action Required:</strong> Please set your password to access your account.</p>
        <p><a href='${sample.resetLink}' style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set Your Password</a></p>
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Link expires in 24 hours.</p>
      </div>`
    : `
      <div class='info'>
        <p><strong>Email Address:</strong> ${sample.candidateEmail}</p>
        <p><strong>Password:</strong> (As set by Administrator)</p>
        <p>You can login <a href='${sample.frontendUrl}/login'>here</a>.</p>
      </div>`;

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .content { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .header { text-align: center; background-color: #f4f4f4; padding: 10px; }
          .footer { text-align: center; font-size: 12px; color: #aaa; margin-top: 20px; }
          .info { margin-bottom: 15px; }
          .button { display: inline-block; padding: 10px 20px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class='content'>
          <div class='header'><h2>Candidate Registration</h2></div>
          <p>Dear ${sample.candidateNameFull},</p>
          <p>Congratulations on your registration! We are pleased to welcome you. Below are your registration details:</p>
          <div class='info'>
            <p><strong>Employee ID:</strong> EMP-1024</p>
            <p><strong>Rank Last Served on Vessel:</strong> Chief Officer</p>
            <p><strong>Prefix:</strong> Mr.</p>
            <p><strong>Surname:</strong> Sharma</p>
            <p><strong>First Name:</strong> Rahul</p>
            <p><strong>Middle Name:</strong> Kumar</p>
            <p><strong>Gender:</strong> Male</p>
            <p><strong>C.D.C / Passport:</strong> P1234567</p>
            <p><strong>Vessel Type:</strong> Container</p>
            <p><strong>Vessel Name:</strong> MOL Horizon</p>
            <p><strong>Birth Date:</strong> 14/08/1990</p>
            <p><strong>Nationality:</strong> Indian</p>
            <p><strong>Seaman Book No.:</strong> SB-778899</p>
            <p><strong>WhatsApp Number:</strong> +91 98765 43210</p>
            <p><strong>Alternate Number:</strong> +91 90000 11111</p>
            <p><strong>Designation:</strong> Deck Officer</p>
            <p><strong>Last Vessel Name:</strong> MOL Prestige</p>
            <p><strong>Next Vessel Name:</strong> MOL Horizon</p>
            <p><strong>Manning Company:</strong> MOL Maritime (India) Pvt. Ltd.</p>
            <p><strong>Sign On Date:</strong> 2026-07-01</p>
            <p><strong>Sign Off Date:</strong> 2026-11-30</p>
            <p><strong>Officer:</strong> Yes</p>
          </div>
          <h3>Account Information</h3>
          ${accountInfoHtml}
          <div class='info'>
            <p>Please review your details carefully. If you notice any discrepancies or have any questions, do not hesitate to reach out.</p>
            <p>We look forward to supporting you on your maritime journey!</p>
          </div>
          <div class='footer'><p>&copy; ${year} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p></div>
        </div>
      </body>
    </html>`;
};

const trainerCourseAssignmentTemplate = () => `
  <div style="font-family: sans-serif; line-height: 1.6; color: #334155;">
    <p>Dear ${sample.trainerName},</p>
    <p>You have been assigned as a Trainer for the course <strong>${sample.courseName}</strong>.</p>
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0;"><strong>Start Date:</strong> 01/07/2026</p>
      <p style="margin: 0;"><strong>End Date:</strong> 05/07/2026</p>
    </div>
    <h4 style="color: #1e293b; margin-top: 24px;">Candidates List:</h4>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; font-family: sans-serif; font-size: 14px;">
      <thead>
        <tr style="background-color: #f8fafc; text-align: left; color: #1e293b;">
          <th>Name</th><th>Email</th><th>Rank</th><th>Manager</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0; color: #334155;">
          <td>${sample.candidateName}</td><td>${sample.candidateEmail}</td><td>Chief Officer</td><td>Vikram Rao</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0; color: #334155;">
          <td>Neha Iyer</td><td>neha.iyer@example.com</td><td>Second Engineer</td><td>Sanjay Menon</td>
        </tr>
      </tbody>
    </table>
    <p style="margin-top: 24px;">Please log in to the portal for more details.</p>
  </div>`;

const activeEnrollmentTemplate = ({ type }) => {
  const locationDetails =
    type === "online"
      ? `<p>This is an Online course. Zoom Link: <a href="${sample.zoomLink}">${sample.zoomLink}</a></p>`
      : `<p>This is an Offline course at <strong>MOLMI Training Centre, Mumbai</strong>.</p>`;

  return `
    <h3>Dear ${sample.candidateName},</h3>
    <p>You have been enrolled in the course <strong>${sample.courseName}</strong>.</p>
    ${locationDetails}
    <p>Please acknowledge your enrollment by clicking one of the links below:</p>
    <p>
      <a href="${sample.approveLink}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Approve</a>
      <a href="${sample.rejectLink}" style="padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin-left: 10px;">Reject</a>
    </p>`;
};

const preActiveNominatorTemplate = () => `
  <h3>Dear ${sample.nominatorName},</h3>
  <p>We invite you to nominate candidates for the upcoming course: <strong>${sample.courseName}</strong>.</p>
  <p><strong>Start Date:</strong> ${formatDate("2026-07-01", "start")}</p>
  <p><strong>End Date:</strong> ${formatDate("2026-07-05", "end")}</p>
  <p>Please click the link below to access the nomination portal. This link is secure and unique to you.</p>
  <a href="${sample.nominationLink}" style="padding: 10px 15px; background: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Nominate Candidates</a>
  <br><br>
  <p>Link expires in 7 days.</p>`;

const preActiveCandidateApprovalTemplate = () => `
  <h3>Dear ${sample.candidateName},</h3>
  <p>You have been nominated to attend the course <strong>${sample.courseName}</strong>.</p>
  <p><strong>Start Date:</strong> ${formatDate("2026-07-01", "start")}</p>
  <p><strong>End Date:</strong> ${formatDate("2026-07-05", "end")}</p>
  <p>Please review your nomination and provide your approval or rejection along with any remarks by clicking the link below:</p>
  <a href="${sample.candidateApprovalLink}" style="padding: 10px 15px; background: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Review Nomination</a>
  <br><br>
  <p>Link expires in 7 days.</p>`;

const outhouseWelcomeTemplate = ({ type }) => {
  const locationDetails =
    type === "online"
      ? `
        <p><strong>Zoom Link:</strong> <a href="${sample.zoomLink}">${sample.zoomLink}</a></p>
        <p><strong>Zoom ID:</strong> 123 456 7890</p>
        <p><strong>Zoom Password:</strong> MOLMI2026</p>`
      : `
        <p><strong>Hotel / Venue:</strong> MOLMI Training Centre, Mumbai</p>
        <p><strong>Address:</strong> 12 Marine Drive, Mumbai, Maharashtra</p>
        <p><strong>Contact:</strong> +91 22 4000 1000</p>
        <p><strong>Email:</strong> training@example.com</p>
        <p><strong>Offline Date:</strong> 2026-07-01</p>
        <p><strong>Remarks:</strong> Please report 30 minutes before the session.</p>`;

  return `
    <h3>Dear ${sample.candidateName},</h3>
    <p>You have been enrolled in the outhouse course <strong>${sample.courseName}</strong>.</p>
    <p><strong>Start Date:</strong> 2026-07-01</p>
    <p><strong>End Date:</strong> 2026-07-05</p>
    ${locationDetails}
    <p>Please acknowledge the email by clicking the link below:</p>
    <p><a href="${sample.approveLink}">Yes, I approve and I will be attending</a></p>`;
};

const templates = [
  {
    title: "Assessment Results - Pass",
    subject: `Assessment Results - ${sample.courseName}`,
    notes: "Post Course assessment, passing score.",
    html: getAssessmentResultTemplate(sample.candidateName, sample.courseName, "Post Course", 86),
  },
  {
    title: "Assessment Results - Fail",
    subject: `Assessment Results - ${sample.courseName}`,
    notes: "Post Course assessment, failing score with retest information.",
    html: getAssessmentResultTemplate(sample.candidateName, sample.courseName, "Post Course", 42),
  },
  {
    title: "New Assessment Assigned",
    subject: `Assessment Assigned - ${sample.courseName}`,
    notes: "Assessment creation notification for a candidate.",
    html: getAssessmentCreationTemplate(sample.candidateName, sample.courseName, sample.assessmentTitle, 2),
  },
  {
    title: "Certificate Generated",
    subject: `Certificate Generated - ${sample.courseName}`,
    notes: "Certificate availability notification.",
    html: getCertificateGenerationTemplate(sample.candidateName, sample.courseName, sample.certificateNo),
  },
  {
    title: "Course Feedback Request",
    subject: `Course Feedback Request - ${sample.courseName}`,
    notes: "Feedback request after course participation.",
    html: getFeedbackRequestTemplate(sample.candidateName, sample.courseName),
  },
  {
    title: "Reimbursement Approved",
    subject: `Reimbursement Approved - ${sample.claimNumber}`,
    notes: "Candidate reimbursement approval notification.",
    html: getReimbursementApprovedTemplate(sample.candidateName, sample.claimNumber, sample.amount),
  },
  {
    title: "Reimbursement Disapproved",
    subject: `Reimbursement Disapproved - ${sample.claimNumber}`,
    notes: "Candidate reimbursement disapproval notification.",
    html: getReimbursementDisapprovedTemplate(sample.candidateName, sample.claimNumber, "Original receipt is required for verification."),
  },
  {
    title: "Reimbursement Resubmission Requested",
    subject: `Reimbursement Resubmission Requested - ${sample.claimNumber}`,
    notes: "Candidate reimbursement return-for-edit notification.",
    html: getReimbursementResubmissionTemplate(sample.candidateName, sample.claimNumber, "Please upload a clearer invoice copy."),
  },
  {
    title: "Candidate Registration - Self Registration",
    subject: "Welcome Aboard! Your Registration Details",
    notes: "Candidate must set a password using the reset link.",
    html: candidateRegistrationTemplate({ isSelfRegistration: true }),
  },
  {
    title: "Candidate Registration - Admin Created",
    subject: "Welcome Aboard! Your Registration Details",
    notes: "Candidate account created by admin with password set separately.",
    html: candidateRegistrationTemplate({ isSelfRegistration: false }),
  },
  {
    title: "Forgot Password",
    subject: "Reset Password Link",
    notes: "Password reset request email.",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center;"><h2>Reset Password Link</h2></div>
        <div style="padding: 20px;">
          <p>Hi ${sample.candidateName},</p>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${sample.resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>If you didn't request this, you can ignore this email.</p>
        </div>
        <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666;">&copy; ${year} Molmi. All rights reserved.</div>
      </div>`,
  },
  {
    title: "Password Reset Successful",
    subject: "Password Reset Successful",
    notes: "Confirmation email after password update.",
    html: `<p>Hi Rahul,</p><p>Your password has been successfully updated.</p>`,
  },
  {
    title: "Admin Account Created",
    subject: "Welcome - Admin Account Created",
    notes: "New admin account credentials notification with sample-only password.",
    html: `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .content { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
            .header { text-align: center; background-color: #f4f4f4; padding: 10px; }
            .footer { text-align: center; font-size: 12px; color: #aaa; margin-top: 20px; }
            .info { margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class='content'>
            <div class='header'><h2>Admin Account Created</h2></div>
            <p>Dear ${sample.adminName},</p>
            <p>An administrative account has been created for you. Below are your login credentials:</p>
            <div class='info'>
              <p><strong>URL:</strong> <a href='${sample.frontendUrl}/login'>${sample.frontendUrl}/login</a></p>
              <p><strong>Username (Email):</strong> ${sample.adminEmail}</p>
              <p><strong>Password:</strong> SamplePassword123</p>
            </div>
            <p>Please log in and update your password for security reasons.</p>
            <div class='footer'><p>&copy; ${year} Molmi. All rights reserved.</p></div>
          </div>
        </body>
      </html>`,
  },
  {
    title: "Trainer Course Assignment Notification",
    subject: `Course Assignment Notification - ${sample.courseName}`,
    notes: "Trainer assignment email with candidate table.",
    html: trainerCourseAssignmentTemplate(),
  },
  {
    title: "Active Course Enrollment - Online",
    subject: `Course Enrollment - ${sample.courseName}`,
    notes: "Candidate enrollment email with Zoom link and acknowledgment actions.",
    html: activeEnrollmentTemplate({ type: "online" }),
  },
  {
    title: "Active Course Enrollment - Offline",
    subject: `Course Enrollment - ${sample.courseName}`,
    notes: "Candidate enrollment email with venue summary and acknowledgment actions.",
    html: activeEnrollmentTemplate({ type: "offline" }),
  },
  {
    title: "Pre-Active Nominator Nomination Request",
    subject: `Nomination Request for Course: ${sample.courseName}`,
    notes: "Nominator invitation to submit candidate nominations.",
    html: preActiveNominatorTemplate(),
  },
  {
    title: "Pre-Active Candidate Nomination Approval",
    subject: `Course Nomination Approval - ${sample.courseName}`,
    notes: "Candidate approval request for pre-active course nomination.",
    html: preActiveCandidateApprovalTemplate(),
  },
  {
    title: "Certificate Expiry Reminder",
    subject: `Certificate Expiry Reminder - ${sample.courseName}`,
    notes: "Certificate renewal reminder from dashboard expiry alerts.",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Certificate Expiry Reminder</h2>
        <p>Dear <strong>${sample.candidateName}</strong>,</p>
        <p>This is a reminder that your certificate for the course <strong>${sample.courseName}</strong> is expiring on <strong>15 Sep 2026</strong>.</p>
        <p>Please take the necessary steps to renew your certification before the expiry date to ensure compliance.</p>
        <br/>
        <p>Regards,</p>
        <p><strong>MOLMI Training Portal</strong></p>
      </div>`,
  },
  {
    title: "Outhouse Welcome Letter - Online",
    subject: `Welcome Letter - ${sample.courseName}`,
    notes: "Outhouse online course welcome letter.",
    html: outhouseWelcomeTemplate({ type: "online" }),
  },
  {
    title: "Outhouse Welcome Letter - Offline",
    subject: `Welcome Letter - ${sample.courseName}`,
    notes: "Outhouse offline course welcome letter with venue details.",
    html: outhouseWelcomeTemplate({ type: "offline" }),
  },
  {
    title: "Accounts Team Approved Reimbursement",
    subject: `Approved Reimbursement - ${sample.claimNumber}`,
    notes: "Accounts team notification with approved reimbursement PDF attachment in live flow.",
    html: `
      <p>Hello Accounts Team,</p>
      <p>A reimbursement claim has been approved.</p>
      <p><strong>Claim No:</strong> ${sample.claimNumber}</p>
      <p><strong>Candidate:</strong> ${sample.candidateName}</p>
      <p><strong>Course:</strong> ${sample.courseName}</p>
      <p><strong>Amount:</strong> ${sample.amount}</p>
      <p>Please find the approved PDF attached.</p>`,
  },
];

const sanitizeFileName = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const renderScreenshots = async () => {
  fs.mkdirSync(tempDir, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  try {
    const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 1 });

    for (const [index, template] of templates.entries()) {
      await page.setContent(fullHtml(template.html), { waitUntil: "load" });
      await page.emulateMedia({ media: "screen" });
      const height = await page.evaluate(() =>
        Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)),
      );
      await page.setViewportSize({ width: 760, height: Math.min(Math.max(height, 900), 2600) });
      const screenshotPath = path.join(tempDir, `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(template.title)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const screenshotHeight = await page.evaluate(() =>
        Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)),
      );
      results.push({ ...template, screenshotPath, screenshotWidth: 760, screenshotHeight });
    }
  } finally {
    await browser.close();
  }

  return results;
};

const docText = (text, options = {}) =>
  new Paragraph({
    ...options,
    children: [new TextRun(text)],
  });

const buildDocument = (items) => {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun("Email Template Screenshots")],
    }),
    docText("Certificate Portal Backend", { alignment: AlignmentType.CENTER }),
    docText(`Generated with sample data on ${new Date().toLocaleDateString("en-IN")}.`, {
      alignment: AlignmentType.CENTER,
    }),
  ];

  for (const item of items) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(item.title)],
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Subject: ", bold: true }),
          new TextRun(item.subject),
        ],
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Sample data: ", bold: true }),
          new TextRun(item.notes),
        ],
      }),
    );
    children.push(new Paragraph({ text: "" }));

    const maxWidth = 560;
    const maxHeight = 700;
    const widthRatio = maxWidth / item.screenshotWidth;
    const heightRatio = maxHeight / item.screenshotHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1);
    const imageWidth = Math.round(item.screenshotWidth * ratio);
    const imageHeight = Math.round(item.screenshotHeight * ratio);

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: fs.readFileSync(item.screenshotPath),
            transformation: {
              width: imageWidth,
              height: imageHeight,
            },
          }),
        ],
      }),
    );
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });
};

const main = async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const screenshots = await renderScreenshots();
  const document = buildDocument(screenshots);
  const buffer = await Packer.toBuffer(document);
  fs.writeFileSync(outputPath, buffer);
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(`Created ${outputPath}`);
  console.log(`Included ${screenshots.length} email template screenshots.`);
};

main().catch((error) => {
  console.error("Failed to generate email template screenshots document:", error);
  process.exitCode = 1;
});
