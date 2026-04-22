const crypto = require("crypto");
const path = require("path");
const OuthouseCourseDao = require("../dao/OuthouseCourseDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const CourseEnrollmentDao = require("../dao/CourseEnrollmentDao");
const HotelFilesDao = require("../dao/hotelFilesDao");
const ActiveCourseDao = require("../dao/ActiveCourseDao");
const emailService = require("../utils/emailService");

const buildDays = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const diffMs = new Date(endDate) - new Date(startDate);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
};

const toFrontendCourse = (course) => ({
  ...course,
  location_type: course.type_of_location,
  type_of_course: course.course_type,
  whatsapp_group: course.whatsapp_link,
  zoom_id: course.zoom_username,
  zoom_password: course.zoom_password,
  feedback_type: course.feedback_type,
  creation_mode: course.creation_mode,
  source_pre_active_id: course.source_pre_active_id,
  days: course.no_of_days,
});

const sendWelcomeEmail = async (course, candidate, venue) => {
  const ackToken = crypto.randomBytes(32).toString("hex");
  await CourseEnrollmentDao.saveAcknowledgmentToken(course.id, candidate.candidate_id, ackToken);

  const portalUrl = process.env.PORTAL_URL || process.env.FRONTEND_URL || "http://localhost:3000";
  const approveLink = `${portalUrl}/acknowledge?token=${ackToken}&action=approve`;

  let html = `
    <h3>Dear ${candidate.candidate_name},</h3>
    <p>You have been enrolled in the outhouse course <strong>${course.course_name}</strong>.</p>
    <p><strong>Start Date:</strong> ${course.start_date}</p>
    <p><strong>End Date:</strong> ${course.end_date}</p>
  `;

  if ((course.type_of_location || "").toLowerCase() === "online") {
    html += `
      <p><strong>Zoom Link:</strong> <a href="${course.zoom_link || "#"}">${course.zoom_link || "N/A"}</a></p>
      <p><strong>Zoom ID:</strong> ${course.zoom_username || "-"}</p>
      <p><strong>Zoom Password:</strong> ${course.zoom_password || "-"}</p>
    `;
  } else if (venue) {
    html += `
      <p><strong>Hotel / Venue:</strong> ${venue.venue_name || "-"}</p>
      <p><strong>Address:</strong> ${venue.venue_address || "-"}</p>
      <p><strong>Contact:</strong> ${venue.venue_contact || "-"}</p>
      <p><strong>Email:</strong> ${venue.venue_email || "-"}</p>
      <p><strong>Offline Date:</strong> ${venue.offline_date || "-"}</p>
      <p><strong>Remarks:</strong> ${venue.remarks || "-"}</p>
    `;
  }

  html += `
    <p>Please acknowledge the email by clicking the link below:</p>
    <p><a href="${approveLink}">Yes, I approve and I will be attending</a></p>
  `;

  await emailService.sendEmail(
    candidate.email,
    `Welcome Letter - ${course.course_name}`,
    html,
  );

  await CourseEnrollmentDao.updateEmailStatus(
    course.id,
    candidate.candidate_id,
    1,
    course.type_of_location || "Manual",
  );
};

exports.getMasterCourseOptions = async (_req, res) => {
  const rows = await OuthouseCourseDao.getMasterCourseOptions();
  res.status(200).json({ data: rows });
};

exports.getPreActiveOptions = async (_req, res) => {
  const rows = await OuthouseCourseDao.getPreActiveOptions();
  res.status(200).json({ data: rows });
};

exports.createCourse = async (req, res) => {
  try {
    const masterCourse = await MasterCourseDao.getById(req.body.master_course_id);
    if (!masterCourse) {
      return res.status(404).json({ message: "Master course not found" });
    }

    const topicName = req.body.topic || masterCourse.topic;
    const year = req.body.start_date
      ? new Date(req.body.start_date).getFullYear()
      : new Date().getFullYear();
    const count = await OuthouseCourseDao.getLastCourseId(topicName);
    const nextId = (count + 1).toString().padStart(3, "0");

    const payload = {
      ...req.body,
      course_id: `${topicName}/${year}/${nextId}`,
      master_course_name: req.body.master_course_name || masterCourse.master_course_name,
      topic: topicName,
      days: req.body.days || buildDays(req.body.start_date, req.body.end_date),
    };

    const course = await OuthouseCourseDao.create(payload);

    if (payload.creation_mode === "conversion" && payload.source_pre_active_id) {
      const candidates = await CourseEnrollmentDao.getEnrolledCandidates(payload.source_pre_active_id);
      const candidateIds = candidates
        .filter((candidate) => candidate.status !== "Deleted")
        .map((candidate) => candidate.candidate_id);
      if (candidateIds.length) {
        await CourseEnrollmentDao.enrollCandidates(course.id, candidateIds, null);
      }
    }

    res.status(201).json({ message: "Outhouse course created", data: course, id: course.id });
  } catch (error) {
    console.error("Error creating outhouse course:", error);
    res.status(500).json({ message: "Error creating outhouse course", error: error.message });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { search, page, limit, status, from_date, to_date, sort_by, sort_order } = req.query;
    const result = await OuthouseCourseDao.getAll(
      search,
      page,
      limit,
      {
        status,
        from_date,
        to_date,
      },
      sort_by,
      sort_order,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching outhouse courses:", error);
    res.status(500).json({ message: "Error fetching outhouse courses", error: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    if (!course) return res.status(404).json({ message: "Outhouse course not found" });
    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
    res.status(200).json({ ...toFrontendCourse(course), candidates });
  } catch (error) {
    console.error("Error fetching outhouse course:", error);
    res.status(500).json({ message: "Error fetching outhouse course", error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const payload = {
      master_course_id: req.body.master_course_id,
      master_course_name: req.body.master_course_name,
      topic: req.body.topic,
      course_name: req.body.course_name,
      description: req.body.description,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      type_of_location: req.body.location_type,
      location_id: req.body.location_id,
      other_location: req.body.other_location,
      course_type: req.body.type_of_course,
      remarks: req.body.remarks,
      status: req.body.status,
      course_level: req.body.course_level,
      whatsapp_link: req.body.whatsapp_group,
      zoom_link: req.body.zoom_link,
      zoom_username: req.body.zoom_id,
      zoom_password: req.body.zoom_password,
      no_of_days: req.body.days || buildDays(req.body.start_date, req.body.end_date),
      feedback_type: req.body.feedback_type,
      creation_mode: req.body.creation_mode,
      source_pre_active_id: req.body.source_pre_active_id,
    };

    const updated = await OuthouseCourseDao.update(req.params.id, payload);
    if (!updated) return res.status(404).json({ message: "Outhouse course not found" });
    const course = await OuthouseCourseDao.getById(req.params.id);
    res.status(200).json({ message: "Outhouse course updated", data: toFrontendCourse(course) });
  } catch (error) {
    console.error("Error updating outhouse course:", error);
    res.status(500).json({ message: "Error updating outhouse course", error: error.message });
  }
};

exports.getCandidates = async (req, res) => {
  try {
    const rows = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
    res.status(200).json({ candidates: rows.filter((row) => row.status !== "Deleted") });
  } catch (error) {
    res.status(500).json({ message: "Error fetching candidates", error: error.message });
  }
};

exports.getCandidateOptions = async (req, res) => {
  try {
    const rows = await OuthouseCourseDao.getCandidateOptions(
      req.params.id,
      req.query.search || "",
    );
    res.status(200).json({ candidates: rows });
  } catch (error) {
    res.status(500).json({ message: "Error fetching candidate options", error: error.message });
  }
};

exports.addCandidates = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    if (!course) return res.status(404).json({ message: "Outhouse course not found" });

    const lastDay = new Date(course.end_date);
    lastDay.setHours(23, 59, 59, 999);
    if (new Date() > lastDay) {
      return res.status(400).json({ message: "Candidates can be added only until the last day of the course" });
    }

    const result = await CourseEnrollmentDao.enrollCandidates(
      req.params.id,
      req.body.candidateIds || [],
      null,
    );

    if ((course.type_of_location || "").toLowerCase() === "online") {
      const enrolled = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
      for (const candidateId of req.body.candidateIds || []) {
        const candidate = enrolled.find((row) => row.candidate_id === candidateId);
        if (candidate?.email) {
          await sendWelcomeEmail(course, candidate, null);
        }
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error adding outhouse candidates:", error);
    res.status(500).json({ message: "Error adding candidates", error: error.message });
  }
};

exports.updateCandidate = async (req, res) => {
  try {
    await CourseEnrollmentDao.updateStatusPool(
      req.params.id,
      req.params.candidateId,
      req.body.status_pool || req.body.statusPool,
    );
    res.status(200).json({ message: "Candidate updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating candidate", error: error.message });
  }
};

exports.deleteCandidate = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    if (!course) return res.status(404).json({ message: "Outhouse course not found" });
    const lastDay = new Date(course.end_date);
    lastDay.setHours(23, 59, 59, 999);
    if (new Date() > lastDay) {
      return res.status(400).json({ message: "Candidates can be deleted only until the last day of the course" });
    }
    await CourseEnrollmentDao.removeCandidate(req.params.id, req.params.candidateId, req.body.remark);
    res.status(200).json({ message: "Candidate soft deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting candidate", error: error.message });
  }
};

exports.sendWelcomeLetter = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    const enrolled = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
    const candidate = enrolled.find((row) => row.candidate_id === req.params.candidateId);
    if (!course || !candidate) {
      return res.status(404).json({ message: "Course or candidate not found" });
    }

    let venue = null;
    if ((course.type_of_location || "").toLowerCase() !== "online") {
      venue = await CourseEnrollmentDao.getCandidateVenueDetails(
        req.params.id,
        req.params.candidateId,
      );
    }

    await sendWelcomeEmail(course, candidate, venue);
    res.status(200).json({ message: "Welcome letter sent" });
  } catch (error) {
    console.error("Error sending outhouse welcome letter:", error);
    res.status(500).json({ message: "Error sending welcome letter", error: error.message });
  }
};

exports.updateVenueDetails = async (req, res) => {
  try {
    const details = {
      venue_name: req.body.hotel_name || req.body.venue_name,
      venue_address: req.body.hotel_address || req.body.venue_address,
      venue_contact: req.body.hotel_contact || req.body.venue_contact,
      venue_email: req.body.hotel_email || req.body.venue_email,
      venue_map_link: req.body.venue_map_link || null,
      offline_date: req.body.offline_date || null,
      remarks: req.body.remarks || null,
    };
    await CourseEnrollmentDao.updateVenueDetails(req.params.id, req.params.candidateId, details);

    if (req.files?.length) {
      const enrolled = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
      const candidate = enrolled.find((row) => row.candidate_id === req.params.candidateId);
      if (candidate) {
        for (const file of req.files) {
          await HotelFilesDao.create({
            ce_id: candidate.id,
            candidate_id: req.params.candidateId,
            file_name: file.filename,
            file_type: file.mimetype,
            uploaded_at: new Date(),
          });
        }
      }
    }

    res.status(200).json({ message: "Venue details saved" });
  } catch (error) {
    res.status(500).json({ message: "Error saving venue details", error: error.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    const candidates = await CourseEnrollmentDao.getAttendanceData(req.params.id);
    res.status(200).json({
      dates: [],
      start_date: course?.start_date,
      end_date: course?.end_date,
      candidates,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendance", error: error.message });
  }
};

exports.saveAttendance = async (req, res) => {
  try {
    for (const row of req.body.attendance || []) {
      const days = row.days || {};
      for (const [date, value] of Object.entries(days)) {
        const status = String(value.status || "Present").toLowerCase();
        await CourseEnrollmentDao.saveAttendanceSingle(
          req.params.id,
          row.candidate_id,
          date,
          status,
          value.remark || null,
        );
      }
    }
    res.status(200).json({ message: "Attendance saved" });
  } catch (error) {
    res.status(500).json({ message: "Error saving attendance", error: error.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const course = await OuthouseCourseDao.getById(req.params.id);
    const documents = await OuthouseCourseDao.getFeedbackDocuments(req.params.id);
    let listing = [];
    if ((course?.feedback_type || "").toLowerCase() === "manual") {
      const status = await CourseEnrollmentDao.getFeedbackStatus(req.params.id);
      listing = status.map((row, index) => ({
        sr_no: index + 1,
        active_course_name: course.course_name,
        employee_id: row.empId,
        employee_name: row.candidate_name,
        average_rating: row.feedback_completed ? "Submitted" : "Pending",
        candidate_id: row.candidate_id,
      }));
    }
    res.status(200).json({ documents, listing });
  } catch (error) {
    res.status(500).json({ message: "Error fetching feedback", error: error.message });
  }
};

exports.uploadFeedbackDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Feedback document is required" });
    const documentId = await OuthouseCourseDao.createFeedbackDocument(req.params.id, req.file);
    if (!documentId) {
      return res.status(400).json({
        message:
          "Feedback document storage is not available because the outhouse feedback table has not been created yet",
      });
    }
    res.status(200).json({ message: "Feedback document uploaded" });
  } catch (error) {
    res.status(500).json({ message: "Error uploading feedback document", error: error.message });
  }
};

exports.resendFeedback = async (_req, res) => {
  res.status(200).json({ message: "Feedback resend recorded" });
};

exports.getCertificates = async (req, res) => {
  try {
    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
    res.status(200).json({
      candidates: candidates
        .filter((row) => row.status !== "Deleted")
        .map((row) => ({
          ...row,
          certificate_no: row.certificate_number || "",
          issue_date: row.certificate_issue_date || null,
          file_url: row.certificate_upload_path
            ? `/${String(row.certificate_upload_path).replace(/\\/g, "/")}`
            : null,
        })),
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching certificates", error: error.message });
  }
};

exports.saveCertificate = async (req, res) => {
  try {
    const data = {
      certificate_number: req.body.certificate_no,
      certificate_issue_date: req.body.issue_date,
      certificate_upload_name: req.file?.filename || null,
      certificate_upload_path: req.file?.path || null,
    };

    await OuthouseCourseDao.saveCandidateCertificate(
      req.params.id,
      req.params.candidateId,
      data,
    );

    res.status(200).json({ message: "Certificate details saved" });
  } catch (error) {
    res.status(500).json({ message: "Error saving certificate details", error: error.message });
  }
};

exports.acknowledgeEnrollment = async (req, res) => {
  try {
    const { token, action, remark } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const enrollment = await CourseEnrollmentDao.getByAckToken(token);
    if (!enrollment) return res.status(404).json({ message: "Invalid or expired token" });

    const status = action === "approve" ? "Approved" : "Rejected";
    await CourseEnrollmentDao.updateAcknowledgmentStatus(
      token,
      status,
      remark || null,
    );

    res.status(200).json({ message: `Enrollment ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error("Error acknowledging enrollment:", error);
    res.status(500).json({ message: "Error acknowledging enrollment", error: error.message });
  }
};
