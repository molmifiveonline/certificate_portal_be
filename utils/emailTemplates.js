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
      <p><strong>Portal link:</strong> <a href="https://certificate.molmi.info/index.php/">https://certificate.molmi.info/index.php/</a></p>
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

module.exports = { getAssessmentResultTemplate };
