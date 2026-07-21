const { getFrontendUrl } = require("./urlUtils");
const portalUrl = getFrontendUrl("https://certificate.molmi.info/index.php/");

const getAssessmentResultTemplate = (
  candidateName,
  courseName,
  typeOfTest,
  score,
) => {
  const isPassed = score >= 60;
  const isPostCourse = typeOfTest === "Post Course" || typeOfTest === "Post";

  let resultSection = "";
  if (isPostCourse && isPassed) {
    resultSection = `
      <p><strong>Result:</strong> Congratulations! You have passed the assessment!</p>
      <p>As you have successfully passed the assessment, we kindly request you to complete the feedback form available on your portal after logging in.</p>`;
  } else if (isPostCourse && !isPassed) {
    resultSection = `
      <p><strong>Retest Information:</strong> Unfortunately, you did not achieve a passing score of 60%. However, you can take a retest from your portal.</p>`;
  }

  return `
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
  <div class="content">
    <div class="header">
      <h2>Assessment Results For Candidate</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>Good Day,</p>
    <p>We hope this message finds you well! We have completed the evaluation of your assessment for <strong>${courseName}</strong>. Here are your results:</p>
    <h3><strong>Assessment Results</strong></h3>
    <div class="info">
      <p><strong>Course Name:</strong> ${courseName}</p>
      <p><strong>Type of Test:</strong> ${typeOfTest}</p>
      <p><strong>Your Score:</strong> ${score}%</p>
      ${resultSection}
      <p><strong>Portal link:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    </div>
    <div class="info">
      <p>We encourage you to review the assessment material and make the most of this opportunity to enhance your skills. If you have any questions or need assistance, feel free to reach out.</p>
      <p>Congratulations once again to those who passed, and best of luck to everyone on your continued learning journey!</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getAssessmentCreationTemplate = (
  candidateName,
  courseName,
  assessmentTitle,
  typeOfTest,
) => {
  const typeLabel =
    { 1: "Pre Course", 2: "Post Course", 3: "Daily" }[typeOfTest] || typeOfTest;

  return `
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
  <div class="content">
    <div class="header">
      <h2>New Assessment Assigned</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>We hope this message finds you well!</p>
    <p>A new assessment has been assigned to you for the course: <strong>${courseName}</strong>.</p>
    <div class="info">
      <p><strong>Assessment:</strong> ${assessmentTitle}</p>
      <p><strong>Type:</strong> ${typeLabel}</p>
      <p>Please log in to your portal to take the assessment.</p>
      <p><strong>Portal link:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getCertificateGenerationTemplate = (
  candidateName,
  courseName,
  certificateNo,
) => {
  return `
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
  <div class="content">
    <div class="header">
      <h2>Certificate Generated</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>Congratulations on completing the course!</p>
    <p>Your certificate for <strong>${courseName}</strong> has been generated successfully.</p>
    <div class="info">
      <p><strong>Certificate No:</strong> ${certificateNo}</p>
      <p>You can view and download your certificate from your candidate portal.</p>
      <p><strong>Portal link:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getFeedbackRequestTemplate = (candidateName, courseName) => {
  return `
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
  <div class="content">
    <div class="header">
      <h2>Course Feedback Request</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>Thank you for participating in the course <strong>${courseName}</strong>.</p>
    <p>We would value your feedback to help us improve our training programs.</p>
    <div class="info">
      <p>Please take a few moments to fill out the feedback form available on your portal.</p>
      <p><strong>Portal link:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getReimbursementApprovedTemplate = (candidateName, claimNumber, amount) => {
  return `
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
  <div class="content">
    <div class="header">
      <h2>Reimbursement Approved</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>Your reimbursement claim has been approved.</p>
    <div class="info">
      <p><strong>Claim No:</strong> ${claimNumber}</p>
      <p><strong>Approved Amount:</strong> ${amount}</p>
      <p>The details have been forwarded to the accounts team for processing.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getReimbursementDisapprovedTemplate = (
  candidateName,
  claimNumber,
  remarks,
) => {
  return `
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
  <div class="content">
    <div class="header">
      <h2>Reimbursement Disapproved</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>We regret to inform you that your reimbursement claim has been disapproved.</p>
    <div class="info">
      <p><strong>Claim No:</strong> ${claimNumber}</p>
      <p><strong>Reason/Remarks:</strong> ${remarks || "No remarks provided"}</p>
      <p>Please log in to the portal to review and correct if necessary.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const getReimbursementResubmissionTemplate = (
  candidateName,
  claimNumber,
  remarks,
) => {
  return `
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
  <div class="content">
    <div class="header">
      <h2>Reimbursement Resubmission Requested</h2>
    </div>
    <p>Dear ${candidateName},</p>
    <p>Your reimbursement claim has been returned to you for editing.</p>
    <div class="info">
      <p><strong>Claim No:</strong> ${claimNumber}</p>
      <p><strong>Remarks from Admin:</strong> ${remarks || "Please check with Admin"}</p>
      <p>Please log in to the portal to edit and resubmit your claim.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

module.exports = {
  getAssessmentResultTemplate,
  getAssessmentCreationTemplate,
  getCertificateGenerationTemplate,
  getFeedbackRequestTemplate,
  getReimbursementApprovedTemplate,
  getReimbursementDisapprovedTemplate,
  getReimbursementResubmissionTemplate,
};
