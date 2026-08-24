const ActiveCourseDao = require("../dao/ActiveCourseDao");
const CourseEnrollmentDao = require("../dao/CourseEnrollmentDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const trainerDao = require("../dao/trainerDao");
const HotelFilesDao = require("../dao/hotelFilesDao");
const CertificateDao = require("../dao/CertificateDao");
const emailService = require("../utils/emailService");
const {
  getAssessmentResultTemplate,
  getCertificateGenerationTemplate,
  getFeedbackRequestTemplate,
} = require("../utils/emailTemplates");
const path = require("path");
const pool = require("../config/db");
const {
  generateCertificateNumber,
  normalizeTopic,
} = require("../utils/certificateNumber");
const { generateTrainingReportPdf } = require("../utils/trainingReportPdf");
const { getFrontendUrl } = require("../utils/urlUtils");

const getCourseLocationDetails = async (course = {}) => {
  if (course.location_id) {
    const LocationDao = require("../dao/LocationDao");
    const location = await LocationDao.getLocationById(course.location_id);
    if (location) {
      return {
        name: location.location_name || "",
        address: location.address || "",
        map_link: location.google_map_link || "",
      };
    }
  }

  return {
    name: course.other_location || course.location || course.location_id || "",
    address: "",
    map_link: "",
  };
};

exports.createCourse = async (req, res) => {
  try {
    const { topic: topicId, start_date, end_date, type_of_course } = req.body;

    // Fetch Master Course to get the Topic Name
    const masterCourse = await MasterCourseDao.getById(topicId);
    if (!masterCourse) {
      return res.status(404).json({ message: "Master Course not found" });
    }
    const topicName = masterCourse.topic;

    // Generate Course ID using Topic Name (format: Topic/Year/Number)
    const year = new Date().getFullYear();
    const count = await ActiveCourseDao.getLastCourseId(topicName);
    const nextId = (count + 1).toString().padStart(3, "0");
    const course_id = `${topicName}/${year}/${nextId}`;

    req.body.course_id = course_id;
    req.body.topic = topicName; // Store Name in DB, not UUID
    // Ensure master_course_id is set correctly (it should be in body, but safeguard)
    req.body.master_course_id = topicId;

    // Map type_of_course to course_type if present
    if (type_of_course) {
      req.body.course_type = type_of_course;
    }

    // Auto-calculate no_of_days from start_date and end_date
    if (start_date && end_date) {
      const diffMs = new Date(end_date) - new Date(start_date);
      const diffDays = Math.max(
        0,
        Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1,
      );
      req.body.no_of_days = diffDays;
    }

    const newCourse = await ActiveCourseDao.create(req.body);

    // Auto-populate candidates for Pre-Active courses
    if (req.body.course_type === "Pre-Active") {
      try {
        const allCandidates =
          await CourseEnrollmentDao.getAllActiveCandidates();
        if (allCandidates && allCandidates.length > 0) {
          const candidateIds = allCandidates.map((c) => c.id);
          const trainerId = req.body.primary_trainer_id; // Use primary trainer for initial enrollment
          await CourseEnrollmentDao.enrollCandidates(
            newCourse.id,
            candidateIds,
            trainerId,
          );
        }
      } catch (enrollErr) {
        console.error(
          "Error auto-populating candidates for Pre-Active course:",
          enrollErr,
        );
      }
    }

    res
      .status(201)
      .json({ message: "Course created successfully", data: newCourse });
  } catch (error) {
    console.error("Error creating course:", error);
    res
      .status(500)
      .json({ message: "Error creating course", error: error.message });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { search, page, limit, status, from_date, to_date } = req.query;
    const filters = { status, from_date, to_date };

    // Role-based filtering
    if (req.user?.role) {
      const role = req.user.role.toLowerCase();
      if (role === "trainer") {
        filters.trainer_id = req.user.id;
      } else if (role === "candidate") {
        filters.candidate_id = req.user.id;
      }
    }

    const result = await ActiveCourseDao.getAll(search, page, limit, filters);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res
      .status(500)
      .json({ message: "Error fetching courses", error: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Auto-progress status from 'Initiated' to 'Course Started' if start date has passed
    const today = new Date();
    const courseStartDate = new Date(course.start_date);
    if (
      course.status === "Initiated" &&
      courseStartDate <= today &&
      course.type_of_course !== "Self-Paced"
    ) {
      const updated = await ActiveCourseDao.update(id, {
        status: "Course Started",
      });
      if (updated) {
        course.status = "Course Started";
      }
    }

    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res
      .status(500)
      .json({ message: "Error fetching course", error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    if (req.body.type_of_course) {
      req.body.course_type = req.body.type_of_course;
      delete req.body.type_of_course;
    }

    if (req.body.topic) {
      const masterCourse = await MasterCourseDao.getById(req.body.topic);
      if (masterCourse) {
        req.body.master_course_id = req.body.topic;
        req.body.topic = masterCourse.topic;
        if (!req.body.master_course_name) {
          req.body.master_course_name = masterCourse.master_course_name;
        }
      }
    }

    const start = req.body.start_date;
    const end = req.body.end_date;
    if (start && end) {
      const diffMs = new Date(end) - new Date(start);
      const diffDays = Math.max(
        0,
        Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1,
      );
      req.body.no_of_days = diffDays;
    }

    const updatedCourse = await ActiveCourseDao.update(req.params.id, req.body);
    if (!updatedCourse) {
      return res
        .status(404)
        .json({ message: "Course not found or update failed" });
    }
    res
      .status(200)
      .json({ message: "Course updated successfully", data: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    res
      .status(500)
      .json({ message: "Error updating course", error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const success = await ActiveCourseDao.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res
      .status(500)
      .json({ message: "Error deleting course", error: error.message });
  }
};

exports.cancelCourse = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Reason is required" });
    const success = await ActiveCourseDao.cancelCourse(req.params.id, reason);
    if (!success) return res.status(404).json({ message: "Course not found" });
    res.status(200).json({ message: "Course cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling course:", error);
    res
      .status(500)
      .json({ message: "Error cancelling course", error: error.message });
  }
};

exports.completeCourse = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Reason is required" });
    const success = await ActiveCourseDao.completeCourse(req.params.id, reason);
    if (!success) return res.status(404).json({ message: "Course not found" });
    res.status(200).json({ message: "Course completed successfully" });
  } catch (error) {
    console.error("Error completing course:", error);
    res
      .status(500)
      .json({ message: "Error completing course", error: error.message });
  }
};

exports.getAvailableCandidates = async (req, res) => {
  try {
    const candidates = await CourseEnrollmentDao.getAvailableCandidates(
      req.params.id,
    );
    res.status(200).json(candidates);
  } catch (error) {
    console.error("Error fetching available candidates:", error);
    res.status(500).json({
      message: "Error fetching available candidates",
      error: error.message,
    });
  }
};

exports.emailPrimaryTrainer = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await ActiveCourseDao.getById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Collect all Trainer IDs (Primary + Secondary)
    const trainerIds = [];
    if (course.primary_trainer_id) trainerIds.push(course.primary_trainer_id);
    if (course.secondary_trainer_ids) {
      const secondaries = course.secondary_trainer_ids.split(",").map(id => id.trim()).filter(Boolean);
      trainerIds.push(...secondaries);
    }

    if (trainerIds.length === 0) {
      return res.status(400).json({ message: "No trainers assigned to this course" });
    }

    // Fetch Candidates List
    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    let candidatesHtml = `<p style="color: #64748b; font-style: italic;">No candidates enrolled yet.</p>`;

    if (candidates && candidates.length > 0) {
      candidatesHtml = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e2e8f0; font-family: sans-serif; font-size: 14px;">
          <thead>
            <tr style="background-color: #f8fafc; text-align: left; color: #1e293b;">
              <th>Name</th>
              <th>Email</th>
              <th>Rank</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            ${candidates.map(c => `
              <tr style="border-bottom: 1px solid #e2e8f0; color: #334155;">
                <td>${c.first_name || ''} ${c.last_name || ''}</td>
                <td>${c.email || '-'}</td>
                <td>${c.rank || '-'}</td>
                <td>${c.manager || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const subject = `Course Assignment Notification - ${course.course_name}`;

    const portalUrl = getFrontendUrl();
    const trainingLocation = await getCourseLocationDetails(course);
    let successfullySent = 0;
    for (const trainerId of trainerIds) {
      const trainer = await trainerDao.getTrainerById(trainerId);
      if (trainer && trainer.email) {
        const { getCourseTrainerHtml } = require("../utils/emailTemplateRenderer");
        const startDateFormatted = course.start_date ? new Date(course.start_date).toLocaleDateString("en-GB").replace(/\//g, '-') : '-';
        const endDateFormatted = course.end_date ? new Date(course.end_date).toLocaleDateString("en-GB").replace(/\//g, '-') : '-';
        const html = getCourseTrainerHtml({
          trainer_name: `${trainer.first_name || ''} ${trainer.last_name || ''}`,
          course_name: course.course_name,
          course_id: course.course_id || course.id || '',
          start_date: startDateFormatted,
          end_date: endDateFormatted,
          duration: course.duration || course.no_of_days || '',
          location_type: course.type_of_location || '',
          training_location: trainingLocation.name,
          whatsapp_group_link: course.whatsapp_link || '',
          description: course.description || ''
        });
        await emailService.sendEmail(trainer.email, subject, html);
        successfullySent++;
      }
    }

    await ActiveCourseDao.update(courseId, { primary_trainer_email_status: 1 });

    res.status(200).json({ message: `Email sent to ${successfullySent} trainer(s)` });
  } catch (error) {
    console.error("Error emailing trainers:", error);
    res.status(500).json({ message: "Error sending email", error: error.message });
  }
};
const isOnlineCourse = (course) => course?.type_of_location === "Online";
const normalizeWelcomeEmailType = (type) =>
  String(type || "").trim().toLowerCase();

const validateWelcomeEmailType = (course, type) => {
  if (!["online", "offline"].includes(type)) {
    return "Welcome letter type must be online or offline.";
  }

  if (isOnlineCourse(course) && type !== "online") {
    return "Online courses can only send online welcome letters.";
  }

  if (!isOnlineCourse(course) && type !== "offline") {
    return "Offline or manual courses can only send offline welcome letters.";
  }

  return null;
};

const sendCandidateEmailNotification = async (course, candidateEnrollment, type) => {
  const crypto = require("crypto");
  const ackToken = crypto.randomBytes(32).toString("hex");
  await CourseEnrollmentDao.saveAcknowledgmentToken(course.id, candidateEnrollment.candidate_id, ackToken);

  const portalUrl = getFrontendUrl();
  const approveLink = `${portalUrl}/acknowledge?token=${ackToken}&action=approve`;
  const rejectLink = `${portalUrl}/acknowledge?token=${ackToken}&action=reject`;

  const acknowledgmentHtml = `
    <p>Please acknowledge your enrollment by clicking one of the links below:</p>
    <p>
      <a href="${approveLink}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Approve</a>
      <a href="${rejectLink}" style="padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin-left: 10px;">Reject</a>
    </p>
  `;

  const trainingLocation = await getCourseLocationDetails(course);

  let trainer_name = "";
  if (course.primary_trainer_id) {
    const trainerDao = require("../dao/trainerDao");
    const primaryTrainer = await trainerDao.getTrainerById(course.primary_trainer_id);
    if (primaryTrainer) {
      trainer_name = `${primaryTrainer.first_name || ''} ${primaryTrainer.last_name || ''}`;
    }
  }

  let venue = null;
  if (type === "offline") {
    venue = await CourseEnrollmentDao.getCandidateVenueDetails(course.id, candidateEnrollment.candidate_id);
  }

  const start_date = course.start_date ? new Date(course.start_date).toLocaleDateString("en-GB").replace(/\//g, '-') : '';
  const end_date = course.end_date ? new Date(course.end_date).toLocaleDateString("en-GB").replace(/\//g, '-') : '';

  const { getWelcomeCandidateOfflineHtml, getWelcomeCandidateOnlineHtml } = require("../utils/emailTemplateRenderer");
  let html = "";
  if (type === "online") {
    html = getWelcomeCandidateOnlineHtml({
      candidate_name: candidateEnrollment.candidate_name || `${candidateEnrollment.first_name || ''} ${candidateEnrollment.last_name || ''}`,
      course_name: course.course_name,
      course_id: course.course_id || course.id || '',
      duration: course.duration || course.no_of_days || '',
      start_date,
      end_date,
      trainer_name,
      start_time: course.start_time,
      end_time: course.end_time,
      location_type: course.type_of_location || '',
      training_location_name: trainingLocation.name,
      training_address: trainingLocation.address,
      training_map_link: trainingLocation.map_link,
      meeting_link: course.zoom_link,
      whatsapp_link: course.whatsapp_link,
      email: candidateEnrollment.email,
      approveLink,
      rejectLink
    });
  } else {
    html = getWelcomeCandidateOfflineHtml({
      candidate_name: candidateEnrollment.candidate_name || `${candidateEnrollment.first_name || ''} ${candidateEnrollment.last_name || ''}`,
      course_name: course.course_name,
      course_id: course.course_id || course.id || '',
      duration: course.duration || course.no_of_days || '',
      start_date,
      end_date,
      trainer_name,
      reporting_time: course.reporting_time,
      start_time: course.start_time,
      end_time: course.end_time,
      location_type: course.type_of_location || '',
      training_location_name: trainingLocation.name,
      training_address: trainingLocation.address,
      training_map_link: trainingLocation.map_link,
      venue_name: venue ? venue.venue_name : '',
      venue_address: venue ? venue.venue_address : '',
      venue_contact: venue ? venue.venue_contact : '',
      venue_map_link: venue ? venue.venue_map_link : '',
      whatsapp_link: course.whatsapp_link,
      email: candidateEnrollment.email,
      approveLink,
      rejectLink,
      type
    });
  }

  await emailService.sendEmail(candidateEnrollment.email, `Course Enrollment - ${course.course_name}`, html);
  await CourseEnrollmentDao.updateEmailStatus(course.id, candidateEnrollment.candidate_id, 1, type === "online" ? "Online" : "Offline");
};

exports.emailCandidate = async (req, res) => {
  try {
    const { id: courseId, candidateId } = req.params;
    const type = normalizeWelcomeEmailType(req.body.type);

    const course = await ActiveCourseDao.getById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const typeError = validateWelcomeEmailType(course, type);
    if (typeError) {
      return res.status(400).json({ message: typeError });
    }

    // Enforce strict check for Offline Course Welcome Letter
    if (type === "offline") {
      const venue = await CourseEnrollmentDao.getCandidateVenueDetails(courseId, candidateId);
      if (!venue || !venue.venue_name || !venue.venue_address || !venue.venue_contact || !venue.from_date || !venue.to_date) {
        return res.status(400).json({ 
          message: "Hotel details and venue date range must be entered for candidate before sending offline welcome letter." 
        });
      }
    }

    const enrollment = await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    const candidateEnrollment = enrollment.find((c) => c.candidate_id == candidateId);

    if (!candidateEnrollment) {
      return res.status(404).json({ message: "Candidate not found in enrollment" });
    }

    await sendCandidateEmailNotification(course, candidateEnrollment, type);

    res.status(200).json({ message: "Email sent to candidate" });
  } catch (error) {
    console.error("Error emailing candidate:", error);
    res.status(500).json({ message: "Error sending email", error: error.message });
  }
};

exports.emailCandidatesBulk = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const { candidateIds } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one candidate is required." });
    }

    const course = await ActiveCourseDao.getById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (!isOnlineCourse(course)) {
      return res.status(400).json({
        message: "Bulk welcome mail is available for online courses only.",
      });
    }

    const uniqueCandidateIds = [...new Set(candidateIds.filter(Boolean))];
    if (uniqueCandidateIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one candidate is required." });
    }

    const enrollments = await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    const enrollmentByCandidateId = new Map(
      enrollments.map((enrollment) => [enrollment.candidate_id, enrollment]),
    );
    const failed = [];
    let sentCount = 0;

    for (const candidateId of uniqueCandidateIds) {
      const candidateEnrollment = enrollmentByCandidateId.get(candidateId);
      if (!candidateEnrollment) {
        failed.push({ candidateId, message: "Candidate not found in enrollment" });
        continue;
      }

      try {
        await sendCandidateEmailNotification(
          course,
          candidateEnrollment,
          "online",
        );
        sentCount++;
      } catch (error) {
        failed.push({ candidateId, message: error.message });
      }
    }

    res.status(200).json({
      success: true,
      requestedCount: uniqueCandidateIds.length,
      sentCount,
      failed,
    });
  } catch (error) {
    console.error("Error bulk emailing candidates:", error);
    res.status(500).json({ message: "Error sending emails", error: error.message });
  }
};

exports.acknowledgeEnrollment = async (req, res) => {
  try {
    const { token, action, remark } = req.body;
    if (!token || !action) return res.status(400).json({ message: "Token and action are required" });
    const status = action === "approve" ? "approved" : "rejected";
    await CourseEnrollmentDao.updateAcknowledgmentStatus(token, status, remark);
    res.status(200).json({ message: "Acknowledgment updated" });
  } catch (error) {
    console.error("Error acknowledging enrollment:", error);
    res.status(500).json({ message: "Error updated acknowledgment", error: error.message });
  }
};

exports.getCandidateVenue = async (req, res) => {
  try {
    const { id, candidateId } = req.params;
    const venue = await CourseEnrollmentDao.getCandidateVenueDetails(id, candidateId);
    if (!venue) return res.status(200).json({ files: [] });
    const files = await HotelFilesDao.getFilesByEnrollmentId(venue.id);
    res.status(200).json({ ...venue, files });
  } catch (error) {
    console.error("Error fetching venue:", error);
    res.status(500).json({ message: "Error fetching venue", error: error.message });
  }
};

exports.updateCandidateVenue = async (req, res) => {
  try {
    const { id, candidateId } = req.params;
    await CourseEnrollmentDao.updateVenueDetails(id, candidateId, req.body);
    if (req.files && req.files.length > 0) {
      const enrollment = await CourseEnrollmentDao.getEnrolledCandidates(id);
      const cand = enrollment.find((c) => c.candidate_id == candidateId);
      if (cand) {
        for (const file of req.files) {
          await HotelFilesDao.create({
            ce_id: cand.id,
            candidate_id: candidateId,
            file_name: file.filename,
            file_type: file.mimetype,
            uploaded_at: new Date(),
          });
        }
      }
    }
    res.status(200).json({ message: "Venue updated" });
  } catch (error) {
    console.error("Error updating venue:", error);
    res.status(500).json({ message: "Error updating venue", error: error.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    const attendance = await CourseEnrollmentDao.getAttendanceData(id);
    res.status(200).json({ candidates: attendance, start_date: course.start_date, end_date: course.end_date });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({ message: "Error fetching attendance", error: error.message });
  }
};

exports.saveAttendanceSingle = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, date, status, reason } = req.body;
    await CourseEnrollmentDao.saveAttendanceSingle(id, candidateId, date, status, reason);
    res.status(200).json({ message: "Attendance saved" });
  } catch (error) {
    console.error("Error saving attendance:", error);
    res.status(500).json({ message: "Error saving attendance", error: error.message });
  }
};

exports.getCandidateAttendance = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const candidateId = req.user.id;
    const attendance = await CourseEnrollmentDao.getCandidateAttendance(courseId, candidateId);
    res.status(200).json(attendance);
  } catch (error) {
    console.error("Error fetching candidate attendance:", error);
    res.status(500).json({ message: "Error fetching attendance", error: error.message });
  }
};

exports.getEnrolledCandidates = async (req, res) => {
  try {
    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(req.params.id);
    res.status(200).json(candidates);
  } catch (error) {
    console.error("Error fetching enrolled candidates:", error);
    res.status(500).json({ message: "Error fetching candidates", error: error.message });
  }
};

exports.enrollCandidates = async (req, res) => {
  try {
    const { candidateIds, trainerId } = req.body;
    const courseId = req.params.id;
    const result = await CourseEnrollmentDao.enrollCandidates(courseId, candidateIds, trainerId);

    // Auto-trigger online Welcome Letter if course is Online and has Zoom link
    try {
      const course = await ActiveCourseDao.getById(courseId);
      if (course && course.type_of_location === "Online" && course.zoom_link) {
        const enrolled = await CourseEnrollmentDao.getEnrolledCandidates(courseId);
        for (const candidateId of candidateIds) {
          const cand = enrolled.find((c) => c.candidate_id == candidateId);
          if (cand) {
            // Trigger asynchronously, don't block response
            sendCandidateEmailNotification(course, cand, "online").catch(console.error);
          }
        }
      }
    } catch (autoErr) {
      console.error("Error auto-triggering online emails:", autoErr);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error enrolling candidates:", error);
    res.status(500).json({ message: "Error enrolling candidates", error: error.message });
  }
};

exports.removeCandidate = async (req, res) => {
  try {
    const { remark } = req.body;
    await CourseEnrollmentDao.removeCandidate(req.params.id, req.params.candidateId, remark);
    res.status(200).json({ message: "Candidate removed" });
  } catch (error) {
    console.error("Error removing candidate:", error);
    res.status(500).json({ message: "Error removing candidate", error: error.message });
  }
};

exports.updateStatusPool = async (req, res) => {
  try {
    const { statusPool } = req.body;
    await CourseEnrollmentDao.updateStatusPool(req.params.id, req.params.candidateId, statusPool);
    res.status(200).json({ message: "Status pool updated" });
  } catch (error) {
    console.error("Error updating status pool:", error);
    res.status(500).json({ message: "Error updating status pool", error: error.message });
  }
};

exports.updateObserverStatus = async (req, res) => {
  try {
    const { isObserver } = req.body;
    await CourseEnrollmentDao.updateObserverStatus(req.params.id, req.params.candidateId, isObserver);
    res.status(200).json({ message: "Observer status updated" });
  } catch (error) {
    console.error("Error updating observer status:", error);
    res.status(500).json({ message: "Error updating observer status", error: error.message });
  }
};

exports.saveAbsentReason = async (req, res) => {
  try {
    const { id } = req.params;
    const { absentReasons, status } = req.body;
    await CourseEnrollmentDao.saveAbsentReason(id, absentReasons, status);
    res.status(200).json({ message: "Absent reasons saved" });
  } catch (error) {
    console.error("Error saving absent reason:", error);
    res.status(500).json({ message: "Error saving absent reason", error: error.message });
  }
};

exports.getAssessmentScores = async (req, res) => {
  try {
    const scores = await CourseEnrollmentDao.getAssessmentScores(req.params.id);
    res.status(200).json({ candidates: scores });
  } catch (error) {
    console.error("Error fetching assessment scores:", error);
    res.status(500).json({ message: "Error fetching assessment scores", error: error.message });
  }
};

exports.updateTrainerComment = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const { candidateId, comment } = req.body;
    await CourseEnrollmentDao.updateTrainerComment(courseId, candidateId, comment);
    res.status(200).json({ message: "Trainer comment updated" });
  } catch (error) {
    console.error("Error updating trainer comment:", error);
    res
      .status(500)
      .json({ message: "Error updating trainer comment", error: error.message });
  }
};

exports.sendAssessmentEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, assessmentId } = req.body;
    const pool = require("../config/db");
    const [candidateRows] = await pool.execute(
      `SELECT u.first_name, u.last_name, u.email, ce.is_present, ce.absent_reasons, ce.is_observer, ce.status, ce.status_pool
       FROM users u
       JOIN courses_enrollment ce ON u.id = ce.candidate_id AND ce.course_id = ?
       WHERE u.id = ?`,
      [id, candidateId]
    );
    if (!candidateRows.length) return res.status(404).json({ message: "Candidate not found" });
    const candidate = candidateRows[0];

    const { isCandidateAbsent } = require("../utils/attendanceUtils");
    if (isCandidateAbsent(candidate)) {
      return res.status(400).json({
        message: candidate.is_observer
          ? "Cannot send assessment email to an observer candidate"
          : "Cannot send assessment email to a candidate who was absent in the course"
      });
    }

    const course = await ActiveCourseDao.getById(id);
    const [assessmentRows] = await pool.execute("SELECT type_of_test FROM assessment WHERE id = ?", [assessmentId]);
    const score = await pool.execute("SELECT score FROM assessment_results WHERE assessment_id = ? AND candidate_id = ? AND course_id = ? AND status = 'Completed' ORDER BY attempt_number DESC LIMIT 1", [assessmentId, candidateId, id]);

    const html = getAssessmentResultTemplate(`${candidate.first_name} ${candidate.last_name}`, course.course_name, assessmentRows[0]?.type_of_test, score[0][0]?.score || 0);
    await emailService.sendEmail(candidate.email, `Assessment Results - ${course.course_name}`, html);
    res.status(200).json({ message: "Email sent" });
  } catch (error) {
    console.error("Error sending assessment email:", error);
    res.status(500).json({ message: "Error sending assessment email", error: error.message });
  }
};

exports.generateTrainingReport = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const [scores, trainer] = await Promise.all([
      CourseEnrollmentDao.getAssessmentScores(id),
      course.primary_trainer_id ? trainerDao.getTrainerById(course.primary_trainer_id) : null,
    ]);

    // Exclude observer candidates from the training report
    const filteredScores = scores.filter(s => !s.is_observer);

    const buffer = await generateTrainingReportPdf(course, filteredScores, trainer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Training_Report_${id}.pdf`);
    res.send(buffer);
  } catch (error) {
    console.error("Error generating report:", error);
    res
      .status(500)
      .json({ message: "Error generating report", error: error.message });
  }
};

exports.getFeedbackStatus = async (req, res) => {
  try {
    const status = await CourseEnrollmentDao.getFeedbackStatus(req.params.id);
    res.status(200).json({ candidates: status });
  } catch (error) {
    console.error("Error fetching feedback status:", error);
    res.status(500).json({ message: "Error fetching feedback status", error: error.message });
  }
};

exports.getCertificateData = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    const data = await CourseEnrollmentDao.getCertificateData(id);
    res.status(200).json({ candidates: data, start_date: course.start_date, end_date: course.end_date });
  } catch (error) {
    console.error("Error fetching certificate data:", error);
    res.status(500).json({ message: "Error fetching certificate data", error: error.message });
  }
};

exports.generateCertificate = async (req, res) => {
  try {
    const { id: activeCourseId } = req.params;
    const { candidateId, issueDate } = req.body;
    const existing = await CertificateDao.getByCandidateAndCourse(candidateId, activeCourseId);
    if (existing) {
      await CourseEnrollmentDao.generateCertificate(activeCourseId, candidateId, existing.id);
      return res.status(200).json({ success: true, message: "Already exists", certificate_id: existing.id });
    }
    // Check if candidate is an observer — observers cannot generate certificates
    const [observerCheck] = await pool.execute(
      "SELECT is_observer FROM courses_enrollment WHERE course_id = ? AND candidate_id = ?",
      [activeCourseId, candidateId],
    );
    if (observerCheck.length > 0 && observerCheck[0].is_observer) {
      return res.status(400).json({ success: false, message: "Observer candidates cannot generate certificates" });
    }

    const course = await ActiveCourseDao.getById(activeCourseId);
    const masterCourse = await MasterCourseDao.getById(course.master_course_id);
    const generationDate = issueDate || new Date().toISOString().slice(0, 10);
    const type = masterCourse.certificate_type || "Others";
    const [candidateRows] = await pool.execute(
      "SELECT cp.nationality FROM users u LEFT JOIN candidate_profiles cp ON u.id = cp.user_id WHERE u.id = ?",
      [candidateId],
    );
    const trainer = await trainerDao.getTrainerById(course.primary_trainer_id);
    const { certificate_no, subid } = await generateCertificateNumber({
      type,
      topic: normalizeTopic(course.topic),
      issueDate: generationDate,
      trainerNationality: trainer?.nationality,
      candidateNationality: candidateRows[0]?.nationality,
    });

    const newCert = await CertificateDao.create({
      certificate_no,
      type,
      topic: normalizeTopic(course.topic),
      course_level: course.course_level || "Operational",
      course_id: course.master_course_id,
      active_course_id: activeCourseId,
      candidate_id: candidateId,
      trainer_id: course.primary_trainer_id,
      location:
        course.type_of_location === "Other"
          ? course.other_location
          : course.type_of_location,
      course_conduct: course.type_of_location === "Online" ? "ONL" : "ONS",
      from_date: course.start_date,
      to_date: course.end_date,
      issue_date: generationDate,
      days: course.no_of_days,
      show_logo: 1,
      is_manual: 0,
      description1: masterCourse.description,
      remarks: "",
      subid
    });

    await CourseEnrollmentDao.generateCertificate(activeCourseId, candidateId, newCert.id);

    // Send email notification to candidate
    try {
      if (candidateId) {
        const [candidateRows] = await pool.execute(
          "SELECT first_name, last_name, email FROM users WHERE id = ?",
          [candidateId],
        );
        const candidate = candidateRows[0];

        if (candidate && candidate.email) {
          const html = getCertificateGenerationTemplate(
            `${candidate.first_name} ${candidate.last_name}`,
            course.course_name,
            certificate_no,
          );
          await emailService.sendEmail(
            candidate.email,
            `Certificate Generated - ${course.course_name}`,
            html,
          );
        }
      }
    } catch (emailError) {
      console.error("Error sending certificate generation email:", emailError);
    }

    res.status(200).json({ success: true, certificate_id: newCert.id });
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCertificateActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, value } = req.body;
    await CourseEnrollmentDao.updateCertificateActive(id, candidateId, value);
    const cert = await CertificateDao.getByCandidateAndCourse(candidateId, id);
    if (cert) await CertificateDao.update(cert.id, { status: value === 1 ? 0 : 1 });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating certificate active:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCertificateHide = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { value } = req.body;
    await CourseEnrollmentDao.updateCertificateHide(certificateId, value);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating certificate hide:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendFeedbackEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(id);

    let count = 0;
    for (const candidate of candidates) {
      if (candidate.status === "Deleted") continue;
      if (candidate.is_observer) continue; // Skip observer candidates

      // Check if already submitted feedback
      const [existing] = await pool.execute(
        "SELECT id FROM feedback_question_answer WHERE candidate_id = ? AND active_course_id = ? LIMIT 1",
        [candidate.candidate_id || candidate.id, id]
      );
      if (existing.length > 0) continue; // Skip if already submitted

      if (candidate.email) {
        const html = getFeedbackRequestTemplate(
          `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || candidate.candidate_name,
          course.course_name
        );
        await emailService.sendEmail(
          candidate.email,
          `Course Feedback Request - ${course.course_name}`,
          html
        );
        count++;
      }
    }

    res.status(200).json({ success: true, message: `Feedback email sent to ${count} candidates.` });
  } catch (error) {
    console.error("Error sending feedback email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
