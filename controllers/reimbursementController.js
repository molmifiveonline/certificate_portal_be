const ReimbursementDao = require("../dao/reimbursementDao");
const LogDao = require("../dao/LogDao");
const { generateReimbursementPdf } = require("../utils/reimbursementPdf");
const path = require("path");
const emailService = require("../utils/emailService");
const {
  getReimbursementApprovedTemplate,
  getReimbursementDisapprovedTemplate,
  getReimbursementResubmissionTemplate,
} = require("../utils/emailTemplates");

const STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  RESUBMISSION_REQUESTED: "resubmission_requested",
  RESUBMITTED: "resubmitted",
  APPROVED: "approved",
  DISAPPROVED: "disapproved",
};

const editableStatuses = [STATUS.DRAFT, STATUS.RESUBMISSION_REQUESTED];
const decisionStatuses = [STATUS.SUBMITTED, STATUS.RESUBMITTED];

const ensureRequiredFields = (body) => {
  const requiredFields = [
    "active_course_id",
    "claim_date",
    "expense_category",
    "expense_description",
    "amount",
  ];

  for (const field of requiredFields) {
    if (!body[field]) {
      return field;
    }
  }

  if (Number(body.amount) <= 0) {
    return "amount";
  }

  return null;
};

const getAccountsRecipients = () =>
  (process.env.REIMBURSEMENT_ACCOUNTS_EMAILS ||
    process.env.ACCOUNTS_TEAM_EMAIL ||
    "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const sendAccountsApprovalEmail = async (reimbursement, pdfFilePath) => {
  const recipients = getAccountsRecipients();
  if (!recipients.length || !process.env.SMTP_USER) {
    return;
  }

  const disclaimer = `<div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px; font-family: Arial, sans-serif; color: #856404; font-size: 14px;"><strong>⚠️ PLEASE IGNORE:</strong> This email is generated for internal review purposes only. Please ignore this email; no action is required.</div>`;
  const subject = `[PLEASE IGNORE] Approved Reimbursement - ${reimbursement.claim_number}`;
  const html = `
    ${disclaimer}
    <p>Hello Accounts Team,</p>
    <p>A reimbursement claim has been approved.</p>
    <p><strong>Claim No:</strong> ${reimbursement.claim_number}</p>
    <p><strong>Candidate:</strong> ${reimbursement.candidate_name || "-"}</p>
    <p><strong>Course:</strong> ${reimbursement.active_course_name || "-"}</p>
    <p><strong>Amount:</strong> ${reimbursement.amount || "-"}</p>
    <p>Please find the approved PDF attached.</p>
  `;

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipients.join(","),
    subject,
    html,
    attachments: [
      {
        filename: `${reimbursement.claim_number}.pdf`,
        path: pdfFilePath,
      },
    ],
  });
};

const logAction = async (req, action, details) => {
  if (!req.user?.id) {
    return;
  }

  await LogDao.createLog({
    user_id: req.user.id,
    action,
    details,
    ip_address: req.ip,
    user_agent: req.get("User-Agent"),
  });
      req.skipActivityLog = true;
};

exports.getMyReimbursements = async (req, res) => {
  try {
    const result = await ReimbursementDao.getCandidateReimbursements(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get My Reimbursements Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getReimbursementById = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (
      req.user.role?.toLowerCase() === "candidate" &&
      String(reimbursement.candidate_id) !== String(req.user.id)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ data: reimbursement });
  } catch (error) {
    console.error("Get Reimbursement By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.createReimbursement = async (req, res) => {
  try {
    const missingField = ensureRequiredFields(req.body);
    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    const isEnrolled = await ReimbursementDao.candidateIsEnrolled(
      req.user.id,
      req.body.active_course_id,
    );

    if (!isEnrolled) {
      return res.status(400).json({
        message: "Candidate is not enrolled in the selected active course",
      });
    }

    const reimbursement = await ReimbursementDao.create(
      {
        ...req.body,
        candidate_id: req.user.id,
        status: STATUS.DRAFT,
      },
      req.files || [],
    );

    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "draft_created",
      null,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "CREATE_REIMBURSEMENT", `Created reimbursement ${reimbursement.claim_number}`);

    res.status(201).json({ data: reimbursement });
  } catch (error) {
    console.error("Create Reimbursement Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateReimbursement = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (String(reimbursement.candidate_id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!editableStatuses.includes(reimbursement.status)) {
      return res.status(409).json({
        message: "Only draft or returned claims can be edited",
      });
    }

    const missingField = ensureRequiredFields(req.body);
    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required` });
    }

    const updated = await ReimbursementDao.update(req.params.id, req.body, req.files || []);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "draft_updated",
      null,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "UPDATE_REIMBURSEMENT", `Updated reimbursement ${reimbursement.claim_number}`);

    res.status(200).json({ data: updated });
  } catch (error) {
    console.error("Update Reimbursement Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.submitReimbursement = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (String(reimbursement.candidate_id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!editableStatuses.includes(reimbursement.status)) {
      return res.status(409).json({ message: "This reimbursement cannot be submitted" });
    }

    const nextStatus =
      reimbursement.status === STATUS.RESUBMISSION_REQUESTED
        ? STATUS.RESUBMITTED
        : STATUS.SUBMITTED;

    await ReimbursementDao.updateStatus(reimbursement.id, nextStatus);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      nextStatus,
      null,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "SUBMIT_REIMBURSEMENT", `Submitted reimbursement ${reimbursement.claim_number}`);

    res.status(200).json({ message: "Reimbursement submitted successfully" });
  } catch (error) {
    console.error("Submit Reimbursement Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAdminReimbursements = async (req, res) => {
  try {
    const result = await ReimbursementDao.getAdminReimbursements(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get Admin Reimbursements Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAdminReimbursementById = async (req, res) => {
  return exports.getReimbursementById(req, res);
};

exports.approveReimbursement = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (!decisionStatuses.includes(reimbursement.status)) {
      return res.status(409).json({ message: "Invalid reimbursement status for approval" });
    }

    reimbursement.admin_remarks = req.body.remarks || null;
    const { filePath, fileUrl } = await generateReimbursementPdf(reimbursement);
    await sendAccountsApprovalEmail(reimbursement, filePath);

    // Send email to Candidate
    try {
      if (reimbursement.candidate_email) {
        const html = getReimbursementApprovedTemplate(
          reimbursement.candidate_name || "Candidate",
          reimbursement.claim_number,
          reimbursement.amount,
        );
        await emailService.sendEmail(
          reimbursement.candidate_email,
          `Reimbursement Approved - ${reimbursement.claim_number}`,
          html,
        );
      }
    } catch (emailError) {
      console.error("Error sending reimbursement approval email to candidate:", emailError);
    }

    await ReimbursementDao.markApproved(reimbursement.id, req.body.remarks, fileUrl);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "approved",
      req.body.remarks,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "APPROVE_REIMBURSEMENT", `Approved reimbursement ${reimbursement.claim_number}`);

    res.status(200).json({ message: "Reimbursement approved successfully" });
  } catch (error) {
    console.error("Approve Reimbursement Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.disapproveReimbursement = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (!decisionStatuses.includes(reimbursement.status)) {
      return res.status(409).json({ message: "Invalid reimbursement status for disapproval" });
    }

    // Send email to Candidate
    try {
      if (reimbursement.candidate_email) {
        const html = getReimbursementDisapprovedTemplate(
          reimbursement.candidate_name || "Candidate",
          reimbursement.claim_number,
          req.body.remarks,
        );
        await emailService.sendEmail(
          reimbursement.candidate_email,
          `Reimbursement Disapproved - ${reimbursement.claim_number}`,
          html,
        );
      }
    } catch (emailError) {
      console.error("Error sending reimbursement disapproval email to candidate:", emailError);
    }

    await ReimbursementDao.markDisapproved(reimbursement.id, req.body.remarks);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "disapproved",
      req.body.remarks,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "DISAPPROVE_REIMBURSEMENT", `Disapproved reimbursement ${reimbursement.claim_number}`);

    res.status(200).json({ message: "Reimbursement disapproved successfully" });
  } catch (error) {
    console.error("Disapprove Reimbursement Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.requestResubmission = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (!decisionStatuses.includes(reimbursement.status)) {
      return res.status(409).json({ message: "Invalid reimbursement status for resubmission" });
    }

    // Send email to Candidate
    try {
      if (reimbursement.candidate_email) {
        const html = getReimbursementResubmissionTemplate(
          reimbursement.candidate_name || "Candidate",
          reimbursement.claim_number,
          req.body.remarks,
        );
        await emailService.sendEmail(
          reimbursement.candidate_email,
          `Reimbursement Resubmission Requested - ${reimbursement.claim_number}`,
          html,
        );
      }
    } catch (emailError) {
      console.error("Error sending reimbursement resubmission email to candidate:", emailError);
    }

    await ReimbursementDao.markResubmissionRequested(reimbursement.id, req.body.remarks);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "resubmission_requested",
      req.body.remarks,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "RETURN_REIMBURSEMENT", `Returned reimbursement ${reimbursement.claim_number} for edit`);

    res.status(200).json({ message: "Reimbursement returned to candidate successfully" });
  } catch (error) {
    console.error("Request Resubmission Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resendApprovedEmail = async (req, res) => {
  try {
    const reimbursement = await ReimbursementDao.getById(req.params.id);
    if (!reimbursement) {
      return res.status(404).json({ message: "Reimbursement not found" });
    }

    if (reimbursement.status !== STATUS.APPROVED || !reimbursement.approved_pdf_url) {
      return res.status(409).json({ message: "Only approved reimbursements can be resent" });
    }

    const pdfFilePath = reimbursement.approved_pdf_url.startsWith("/uploads/")
      ? path.join(
          __dirname,
          "..",
          reimbursement.approved_pdf_url.replace(/^\//, ""),
        )
      : reimbursement.approved_pdf_url;
    await sendAccountsApprovalEmail(reimbursement, pdfFilePath);
    await ReimbursementDao.createActivityLog(
      reimbursement.id,
      "approved_email_resent",
      null,
      req.user.id,
      req.user.role,
    );
    await logAction(req, "RESEND_REIMBURSEMENT_EMAIL", `Resent reimbursement ${reimbursement.claim_number} to accounts`);

    res.status(200).json({ message: "Approved reimbursement email resent successfully" });
  } catch (error) {
    console.error("Resend Approved Email Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
