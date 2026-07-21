const PreActiveCourseDao = require("../dao/PreActiveCourseDao");
const NominatorDao = require("../dao/nominatorDao");
const CourseEnrollmentDao = require("../dao/CourseEnrollmentDao");
const emailService = require("../utils/emailService");
const { getFrontendUrl } = require("../utils/urlUtils");

const getNominatorDisplayName = (nominator = {}) =>
  [nominator.first_name, nominator.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() ||
  nominator.name ||
  nominator.email ||
  "Nominator";

const pad = (value) => String(value).padStart(2, "0");

const formatEmailDateTime = (value, type = "none") => {
  if (!value) return "-";

  if (typeof value === "string") {
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = value.match(/(?:T|\s)(\d{2}):(\d{2})/);

    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const hour = timeMatch?.[1] || "00";
      const minute = timeMatch?.[2] || "00";

      if (hour === "00" && minute === "00") {
        if (type === "start") return `${day}-${month}-${year}, 00:00`;
        if (type === "end") return `${day}-${month}-${year}, 23:59`;
        return `${day}-${month}-${year}`;
      }
      return `${day}-${month}-${year}, ${hour}:${minute}`;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  const day = pad(parsed.getDate());
  const month = pad(parsed.getMonth() + 1);
  const year = parsed.getFullYear();
  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();

  if (hours === 0 && minutes === 0) {
    if (type === "start") return `${day}-${month}-${year}, 00:00`;
    if (type === "end") return `${day}-${month}-${year}, 23:59`;
    return `${day}-${month}-${year}`;
  }

  return `${day}-${month}-${year}, ${pad(hours)}:${pad(minutes)}`;
};

// ==========================================
// Pre-Active Course Management
// ==========================================

exports.createCourse = async (req, res) => {
  try {
    const course = await PreActiveCourseDao.createPreActiveCourse(req.body);
    if (course) {
      // Trigger automatic notification to nominators (Centres)
      sendCourseNotificationsToNominators(course.id).catch((err) => {
        console.error(
          "Automatic notifications failed on course creation:",
          err,
        );
      });

      res
        .status(201)
        .json({ message: "Pre-Active course created", data: course });
    } else {
      res.status(400).json({ message: "Failed to create course" });
    }
  } catch (error) {
    console.error("Error creating pre-active course:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { search, page, limit, status, from_date, to_date } = req.query;

    // If the logged in user is a Nominator, only show courses they've been notified about
    if (req.user && req.user.nominator_id) {
      const courses = await PreActiveCourseDao.getNominatorNotifiedCourses(
        req.user.nominator_id,
      );
      return res.status(200).json({ data: courses });
    }

    const filters = { status, from_date, to_date };
    const result = await PreActiveCourseDao.getAllPreActiveCourses(
      search,
      page,
      limit,
      filters,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching pre-active courses:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await PreActiveCourseDao.getPreActiveCourseById(
      req.params.id,
    );
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const updatedCourse = await PreActiveCourseDao.updatePreActiveCourse(
      req.params.id,
      req.body,
    );
    if (!updatedCourse)
      return res
        .status(404)
        .json({ message: "Course not found or update failed" });
    res
      .status(200)
      .json({ message: "Course updated successfully", data: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const success = await PreActiveCourseDao.deletePreActiveCourse(
      req.params.id,
    );
    if (!success) return res.status(404).json({ message: "Course not found" });
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// ==========================================
// Nominator Notification & Portal
// ==========================================

// Helper to notify nominators
const sendCourseNotificationsToNominators = async (courseId) => {
  const course = await PreActiveCourseDao.getPreActiveCourseById(courseId);
  if (!course) throw new Error("Course not found");

  const nominatorsResult = await NominatorDao.getAllNominators(
    null,
    null,
    null,
  );
  const nominators = nominatorsResult.data || []; // Fix iteration bug
  let sentCount = 0;

  for (const nominator of nominators) {
    if (nominator.email) {
      const token = await PreActiveCourseDao.createToken(
        courseId,
        nominator.id,
        "Nominator",
      );

      const frontendUrl = getFrontendUrl();
      const portalLink = `${frontendUrl}/nominate/${token}`;

      const subject = `Nomination Request for Course: ${course.course_name}`;
      const html = `
                  <h3>Dear ${getNominatorDisplayName(nominator)},</h3>
                  <p>We invite you to nominate candidates for the upcoming course: <strong>${course.course_name}</strong>.</p>
                  <p><strong>Start Date:</strong> ${formatEmailDateTime(course.start_date, "start")}</p>
                  <p><strong>End Date:</strong> ${formatEmailDateTime(course.end_date, "end")}</p>
                  <p>Please click the link below to access the nomination portal. This link is secure and unique to you.</p>
                  <a href="${portalLink}" style="padding: 10px 15px; background: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Nominate Candidates</a>
                  <br><br>
                  <p>Link expires in 7 days.</p>
              `;

      await emailService.sendEmail(nominator.email, subject, html);
      sentCount++;
    }
  }
  return sentCount;
};

exports.notifyNominators = async (req, res) => {
  try {
    const courseId = req.params.id;
    const sentCount = await sendCourseNotificationsToNominators(courseId);
    res
      .status(200)
      .json({ message: `Emails sent to ${sentCount} nominators.` });
  } catch (error) {
    console.error("Error notifying nominators:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getCourseByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const details = await PreActiveCourseDao.getTokenDetails(token);
    if (!details)
      return res.status(401).json({ message: "Invalid or expired token" });

    const course = await PreActiveCourseDao.getPreActiveCourseById(
      details.course_id,
    );
    if (!course)
      return res.status(404).json({ message: "Course no longer available" });

    const nominations = await PreActiveCourseDao.getNominatorEnrollments(
      details.course_id,
      details.entity_id,
    );

    res.status(200).json({
      course,
      entity_type: details.entity_type,
      entity_id: details.entity_id,
      nominations,
    });
  } catch (error) {
    console.error("Error validating token:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getAvailableOthersCandidatesByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const details = await PreActiveCourseDao.getTokenDetails(token);
    if (!details || details.entity_type !== "Nominator") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const candidates = await PreActiveCourseDao.getAvailableOthersCandidates(
      details.course_id,
    );
    res.status(200).json(candidates);
  } catch (error) {
    console.error("Error fetching available candidates by token:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.nominatorAddCandidate = async (req, res) => {
  try {
    const { token } = req.params;
    const { candidates } = req.body;

    const details = await PreActiveCourseDao.getTokenDetails(token);
    if (!details || details.entity_type !== "Nominator") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const courseId = details.course_id;
    const nominatorId = details.entity_id;
    const course = await PreActiveCourseDao.getPreActiveCourseById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const frontendUrl = getFrontendUrl();
    const enrollmentIds = [];

    for (const candidateData of candidates) {
      const enrollmentId = await PreActiveCourseDao.enrollCandidateByNominator(
        courseId,
        nominatorId,
        candidateData,
      );
      enrollmentIds.push(enrollmentId);

      // Automatically notify the candidate
      // We need candidate_id which is determined inside enrollCandidateByNominator
      // Let's fetch the enrollment to get the candidate_id for token generation
      const enrollment =
        await CourseEnrollmentDao.getEnrollmentById(enrollmentId);
      if (enrollment && enrollment.email) {
        const candidateToken = await PreActiveCourseDao.createToken(
          courseId,
          enrollment.candidate_id,
          "Candidate",
        );
        const portalLink = `${frontendUrl}/candidate-approval/${candidateToken}`;

        const subject = `Course Nomination Approval - ${course.course_name}`;
        const html = `
                    <h3>Dear ${enrollment.first_name},</h3>
                    <p>You have been nominated to attend the course <strong>${course.course_name}</strong>.</p>
                    <p><strong>Start Date:</strong> ${formatEmailDateTime(course.start_date, "start")}</p>
                    <p><strong>End Date:</strong> ${formatEmailDateTime(course.end_date, "end")}</p>
                    <p>Please review your nomination and provide your approval or rejection along with any remarks by clicking the link below:</p>
                    <a href="${portalLink}" style="padding: 10px 15px; background: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Review Nomination</a>
                    <br><br>
                    <p>Link expires in 7 days.</p>
                `;

        await emailService.sendEmail(enrollment.email, subject, html);
      }
    }

    res.status(201).json({
      message: "Candidates nominated and notified successfully",
      enrollmentIds,
    });
  } catch (error) {
    console.error("Error nominating candidates:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.getEnrolledCandidates = async (req, res) => {
  try {
    const courseId = req.params.id;
    const enrollments =
      await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    res.status(200).json(enrollments);
  } catch (error) {
    console.error("Error fetching enrolled candidates:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// ==========================================
// Candidate Notification & Approval
// ==========================================

exports.notifyCandidates = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await PreActiveCourseDao.getPreActiveCourseById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const enrollments =
      await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    let sentCount = 0;

    const frontendUrl = getFrontendUrl();

    for (const candidate of enrollments) {
      // Only send to pending candidates
      if (
        candidate.email &&
        candidate.candidate_approval_status === "Pending"
      ) {
        const token = await PreActiveCourseDao.createToken(
          courseId,
          candidate.candidate_id,
          "Candidate",
        );
        const portalLink = `${frontendUrl}/candidate-approval/${token}`;

        const subject = `Course Nomination Approval - ${course.course_name}`;
        const html = `
                    <h3>Dear ${candidate.candidate_name},</h3>
                    <p>You have been nominated to attend the course <strong>${course.course_name}</strong>.</p>
                    <p><strong>Start Date:</strong> ${formatEmailDateTime(course.start_date, "start")}</p>
                    <p><strong>End Date:</strong> ${formatEmailDateTime(course.end_date, "end")}</p>
                    <p>Please review your nomination and provide your approval or rejection along with any remarks by clicking the link below:</p>
                    <a href="${portalLink}" style="padding: 10px 15px; background: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Review Nomination</a>
                    <br><br>
                    <p>Link expires in 7 days.</p>
                `;

        await emailService.sendEmail(candidate.email, subject, html);
        sentCount++;
      }
    }

    res
      .status(200)
      .json({ message: `Emails sent to ${sentCount} pending candidates.` });
  } catch (error) {
    console.error("Error notifying candidates:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.candidateApproval = async (req, res) => {
  try {
    const { token } = req.params;
    const { status, remark, rejection_reason, available_date } = req.body; // 'Approved' or 'Rejected'

    const details = await PreActiveCourseDao.getTokenDetails(token);
    if (!details || details.entity_type !== "Candidate") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const success = await PreActiveCourseDao.updateCandidateApproval(
      details.course_id,
      details.entity_id,
      status,
      remark,
      rejection_reason,
      available_date,
    );

    if (success) {
      // Revoke token after use
      await PreActiveCourseDao.revokeToken(token);
      res.status(200).json({ message: `Nomination ${status} successfully.` });
    } else {
      res.status(400).json({ message: "Failed to update approval." });
    }
  } catch (error) {
    console.error("Error in candidate approval:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// ==========================================
// Admin Actions & Report
// ==========================================

exports.getPendingAdminApprovals = async (req, res) => {
  try {
    const rows = await PreActiveCourseDao.getPendingAdminApprovals(
      req.params.id,
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching admin approvals:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getRejectedCandidateApprovals = async (req, res) => {
  try {
    const result = await PreActiveCourseDao.getRejectedCandidateApprovals({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      admin_status: req.query.admin_status,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching rejected candidate approvals:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.adminApproval = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { status, remark } = req.body; // 'Approved' or 'Rejected'

    const success = await PreActiveCourseDao.updateAdminApproval(
      enrollmentId,
      status,
      remark,
    );
    if (success) {
      res.status(200).json({ message: `Candidate ${status} by Admin.` });
    } else {
      res.status(400).json({ message: "Failed to update admin approval." });
    }
  } catch (error) {
    console.error("Error in admin approval:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.convertToActiveCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await PreActiveCourseDao.getPreActiveCourseById(courseId);

    if (!course)
      return res.status(404).json({ message: "Pre-Active course not found." });

    // Barrier: We can close pre-active course 1 day prior and not after that.
    // E.g. start_date is 2026-03-05. Today is <= 2026-03-04.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDateLine = new Date(course.start_date);
    startDateLine.setHours(0, 0, 0, 0);
    startDateLine.setDate(startDateLine.getDate() - 1);

    if (today > startDateLine) {
      return res.status(400).json({
        message:
          "Cannot convert course. The deadline (1 day prior to start date) has passed.",
      });
    }

    const success = await PreActiveCourseDao.convertToActiveCourse(courseId);

    if (success) {
      res
        .status(200)
        .json({ message: "Course converted to Active Course successfully." });
    } else {
      res.status(400).json({ message: "Failed to convert course." });
    }
  } catch (error) {
    console.error("Error converting course:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getAdminRemarksReport = async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      course_id: req.query.course_id,
      candidate_id: req.query.candidate_id,
    };
    const rows = await PreActiveCourseDao.getAdminRemarksReport(filters);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error getting admin remarks report:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.getNominatorToken = async (req, res) => {
  try {
    const courseId = req.params.id;
    const nominatorId = req.user.nominator_id;
    if (!nominatorId) {
      return res
        .status(403)
        .json({ message: "Only nominators can access this functionality." });
    }

    const token = await PreActiveCourseDao.createToken(
      courseId,
      nominatorId,
      "Nominator",
    );
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error getting nominator token:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
