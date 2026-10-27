const DashboardDao = require("../dao/DashboardDao");
const emailService = require("../utils/emailService");

exports.getStats = async (req, res) => {
  try {
    const stats = await DashboardDao.getStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res
      .status(500)
      .json({ message: "Error fetching stats", error: error.message });
  }
};

exports.getCandidateStats = async (req, res) => {
  try {
    const candidateId = req.user.id;
    const stats = await DashboardDao.getCandidateStats(candidateId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching candidate stats:", error);
    res
      .status(500)
      .json({ message: "Error fetching candidate stats", error: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const filters = {
      trainer_id: req.query.trainer_id,
      master_course_id: req.query.master_course_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      status: req.query.status,
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await DashboardDao.getCourses(filters, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching dashboard courses:", error);
    res
      .status(500)
      .json({
        message: "Error fetching dashboard courses",
        error: error.message,
      });
  }
};

exports.getExpiryAlerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await DashboardDao.getExpiryAlerts(page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching expiry alerts:", error);
    res
      .status(500)
      .json({ message: "Error fetching expiry alerts", error: error.message });
  }
};

exports.notifyExpiryCandidate = async (req, res) => {
  try {
    const { email, first_name, last_name, course_name, certificate_expiry_date } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Candidate email is required" });
    }

    const formattedDate = new Date(certificate_expiry_date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const subject = `Certificate Expiry Reminder - ${course_name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">Certificate Expiry Reminder</h2>
        <p>Dear <strong>${first_name} ${last_name || ""}</strong>,</p>
        <p>This is a reminder that your certificate for the course <strong>${course_name}</strong> is expiring on <strong>${formattedDate}</strong>.</p>
        <p>Please take the necessary steps to renew your certification before the expiry date to ensure compliance.</p>
        <br/>
        <p>Regards,</p>
        <p><strong>MOLMI Training Portal</strong></p>
      </div>
    `;

    await emailService.sendEmail(email, subject, html);

    res.status(200).json({ message: `Notification sent to ${first_name}` });
  } catch (error) {
    console.error("Error sending expiry notification:", error);
    res
      .status(500)
      .json({ message: "Failed to send notification", error: error.message });
  }
};
