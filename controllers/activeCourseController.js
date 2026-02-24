const ActiveCourseDao = require("../dao/ActiveCourseDao");
const CourseEnrollmentDao = require("../dao/CourseEnrollmentDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const trainerDao = require("../dao/trainerDao");
const HotelFilesDao = require("../dao/hotelFilesDao");
const CertificateDao = require("../dao/CertificateDao");
const emailService = require("../utils/emailService");
const { getAssessmentResultTemplate } = require("../utils/emailTemplates");
const path = require("path");

exports.createCourse = async (req, res) => {
  try {
    const { topic: topicId, start_date, type_of_course } = req.body;

    // Fetch Master Course to get the Topic Name
    const masterCourse = await MasterCourseDao.getById(topicId);
    if (!masterCourse) {
      return res.status(404).json({ message: "Master Course not found" });
    }
    const topicName = masterCourse.topic;

    // Generate Course ID using Topic Name
    const year = new Date().getFullYear();
    const count = await ActiveCourseDao.getLastCourseId(topicName);
    const nextId = (count + 1).toString().padStart(3, "0");
    const course_id = `${topicName}-${year}-${nextId}`;

    req.body.course_id = course_id;
    req.body.topic = topicName; // Store Name in DB, not UUID
    // Ensure master_course_id is set correctly (it should be in body, but safeguard)
    req.body.master_course_id = topicId;

    // Map type_of_course to course_type if present
    if (type_of_course) {
      req.body.course_type = type_of_course;
    }

    const newCourse = await ActiveCourseDao.create(req.body);
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
    const course = await ActiveCourseDao.getById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
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
    // Map type_of_course to course_type if present, and remove the original key
    if (req.body.type_of_course) {
      req.body.course_type = req.body.type_of_course;
      delete req.body.type_of_course;
    }

    // If topic is provided (which is usually UUID from frontend), fetch the name
    if (req.body.topic) {
      const masterCourse = await MasterCourseDao.getById(req.body.topic);
      if (masterCourse) {
        req.body.topic = masterCourse.topic;
        // Also update master_course_name if not provided or if we want to sync it
        if (!req.body.master_course_name) {
          req.body.master_course_name = masterCourse.master_course_name;
        }
      }
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

// --- New Methods for Course Operations and Enrollment ---

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

exports.getEnrolledCandidates = async (req, res) => {
  try {
    const candidates = await CourseEnrollmentDao.getEnrolledCandidates(
      req.params.id,
    );
    res.status(200).json(candidates);
  } catch (error) {
    console.error("Error fetching enrolled candidates:", error);
    res
      .status(500)
      .json({ message: "Error fetching candidates", error: error.message });
  }
};

exports.enrollCandidates = async (req, res) => {
  try {
    const { candidateIds, trainerId } = req.body;
    const courseId = req.params.id;

    const result = await CourseEnrollmentDao.enrollCandidates(
      courseId,
      candidateIds,
      trainerId,
    );

    // Automatic Email for Online Courses
    try {
      const course = await ActiveCourseDao.getById(courseId);
      if (course && course.type_of_location === "Online") {
        const allEnrolled =
          await CourseEnrollmentDao.getEnrolledCandidates(courseId);
        // Filter properly
        const newCandidates = allEnrolled.filter(
          (c) =>
            candidateIds.includes(c.candidate_id) ||
            candidateIds.includes(String(c.candidate_id)),
        );

        for (const candidate of newCandidates) {
          if (candidate.email) {
            const subject = `Course Welcome Letter - ${course.course_name}`;
            const html = `
                <h3>Dear ${candidate.candidate_name},</h3>
                <p>Welcome to the course <strong>${course.course_name}</strong>.</p>
                <p>This is an Online course.</p>
                <p><strong>Zoom Link:</strong> <a href="${course.zoom_link}">${course.zoom_link}</a></p>
                <p><strong>Start Date:</strong> ${course.start_date}</p>
                <p><strong>Time:</strong> ${course.start_time || "N/A"}</p>
              `;

            await emailService.sendEmail(candidate.email, subject, html);

            // Update status
            await CourseEnrollmentDao.updateEmailStatus(
              courseId,
              candidate.candidate_id,
              1,
              "Online",
            );
          }
        }
      }
    } catch (emailError) {
      console.error("Error sending automatic emails:", emailError);
      // Don't fail the enrollment request, just log error
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error enrolling candidates:", error);
    res
      .status(500)
      .json({ message: "Error enrolling candidates", error: error.message });
  }
};

exports.removeCandidate = async (req, res) => {
  try {
    const { remark } = req.body; // Expect remark in body
    const success = await CourseEnrollmentDao.removeCandidate(
      req.params.id,
      req.params.candidateId,
      remark,
    );
    if (!success)
      return res
        .status(404)
        .json({ message: "Candidate not found or not enrolled" });
    res.status(200).json({ message: "Candidate removed successfully" });
  } catch (error) {
    console.error("Error removing candidate:", error);
    res
      .status(500)
      .json({ message: "Error removing candidate", error: error.message });
  }
};

exports.updateStatusPool = async (req, res) => {
  try {
    const { statusPool } = req.body;
    const success = await CourseEnrollmentDao.updateStatusPool(
      req.params.id,
      req.params.candidateId,
      statusPool,
    );
    if (!success)
      return res
        .status(404)
        .json({ message: "Candidate not found or update failed" });
    res.status(200).json({ message: "Status pool updated successfully" });
  } catch (error) {
    console.error("Error updating status pool:", error);
    res
      .status(500)
      .json({ message: "Error updating status pool", error: error.message });
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

    const trainer = await trainerDao.getById(course.primary_trainer_id);
    if (!trainer)
      return res.status(404).json({ message: "Primary Trainer not found" });

    // Construct Email Content
    const subject = `Course Enrollment Confirmation - ${course.course_name}`;
    const html = `
      <h3>Dear ${trainer.first_name} ${trainer.last_name},</h3>
      <p>You have been assigned as the Primary Trainer for the following course:</p>
      <ul>
        <li><strong>Course Name:</strong> ${course.course_name}</li>
        <li><strong>Start Date:</strong> ${course.start_date}</li>
        <li><strong>End Date:</strong> ${course.end_date}</li>
        <li><strong>Location:</strong> ${course.location || course.type_of_location}</li>
        <li><strong>WhatsApp Group:</strong> ${course.whatsapp_link || "N/A"}</li>
      </ul>
      <p>Please review the details.</p>
      <p>Best Regards,<br>Molmi Team</p>
    `;

    await emailService.sendEmail(trainer.email, subject, html);

    // Send to Secondary Trainers
    if (course.secondary_trainer_ids) {
      const secondaryIds = course.secondary_trainer_ids
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      for (const secId of secondaryIds) {
        try {
          const secTrainer = await TrainerDao.getById(secId);
          if (secTrainer && secTrainer.email) {
            const secHtml = html
              .replace(
                `Dear ${trainer.first_name} ${trainer.last_name},`,
                `Dear ${secTrainer.first_name} ${secTrainer.last_name},`,
              )
              .replace(
                "assigned as the Primary Trainer",
                "assigned as a Secondary Trainer",
              );
            await emailService.sendEmail(secTrainer.email, subject, secHtml);
          }
        } catch (err) {
          console.error(`Failed to email secondary trainer ${secId}:`, err);
        }
      }
    }

    // Update status
    await ActiveCourseDao.update(courseId, { primary_trainer_email_status: 1 });

    res.status(200).json({ message: "Emails sent to Trainers" });
  } catch (error) {
    console.error("Error emailing primary trainer:", error);
    res
      .status(500)
      .json({ message: "Failed to send email", error: error.message });
  }
};

exports.emailCandidate = async (req, res) => {
  try {
    const { id: courseId, candidateId } = req.params;
    const { type } = req.body; // 'online' or 'offline'

    const course = await ActiveCourseDao.getById(courseId);
    const enrollment =
      await CourseEnrollmentDao.getEnrolledCandidates(courseId);
    const candidateEnrollment = enrollment.find(
      (c) => c.candidate_id == candidateId,
    );

    if (!course || !candidateEnrollment) {
      return res.status(404).json({ message: "Course or Candidate not found" });
    }

    let subject = `Course Welcome Letter - ${course.course_name}`;
    let html = "";
    let attachments = [];

    if (type === "offline") {
      const venueParams = await CourseEnrollmentDao.getCandidateVenueDetails(
        courseId,
        candidateId,
      );
      if (!venueParams || !venueParams.venue_name) {
        return res
          .status(400)
          .json({ message: "Venue details are missing for this candidate." });
      }

      // Fetch files
      const files = await HotelFilesDao.getFilesByEnrollmentId(
        candidateEnrollment.id,
      );
      // Note: enrollment.find returns row joined with user, does it have 'id' (pk of courses_enrollment)?
      // CourseEnrollmentDao.getEnrolledCandidates select ce.*, so yes.

      html = `
        <h3>Dear ${candidateEnrollment.candidate_name},</h3>
        <p>Welcome to the course <strong>${course.course_name}</strong>.</p>
        <p>This is an Offline course.</p>
        <p><strong>Venue:</strong> ${venueParams.venue_name}</p>
        <p><strong>Address:</strong> ${venueParams.venue_address || ""}</p>
        <p><strong>Contact:</strong> ${venueParams.venue_contact || ""}</p>
        <p><strong>Map:</strong> <a href="${venueParams.venue_map_link}">View on Map</a></p>
        <p>Please find attached details.</p>
      `;

      if (files && files.length > 0) {
        attachments = files.map((f) => ({
          filename: f.file_name,
          path: path.join(__dirname, "../uploads/venues", f.file_name), // Adjust path carefully
        }));
      }
    } else {
      // Online
      html = `
        <h3>Dear ${candidateEnrollment.candidate_name},</h3>
        <p>Welcome to the course <strong>${course.course_name}</strong>.</p>
        <p>This is an Online course.</p>
        <p><strong>Zoom Link:</strong> <a href="${course.zoom_link}">${course.zoom_link}</a></p>
        <p><strong>Start Date:</strong> ${course.start_date}</p>
        <p><strong>Time:</strong> ${course.start_time || "N/A"}</p>
      `;
    }

    await emailService.sendEmail(
      candidateEnrollment.email,
      subject,
      html,
      attachments,
    );

    // Update status
    await CourseEnrollmentDao.updateEmailStatus(
      courseId,
      candidateId,
      1,
      type === "online" ? "Online" : "Offline",
    );

    res.status(200).json({ message: "Email sent to candidate" });
  } catch (error) {
    console.error("Error emailing candidate:", error);
    res
      .status(500)
      .json({ message: "Failed to send email", error: error.message });
  }
};

exports.getCandidateVenue = async (req, res) => {
  try {
    const { id: courseId, candidateId } = req.params;
    const details = await CourseEnrollmentDao.getCandidateVenueDetails(
      courseId,
      candidateId,
    );

    // We also need enrollment ID to fetch files.
    // details might be null if no venue set?
    // getCandidateVenueDetails in DAO queries courses_enrollment, so it should return the row even if columns null.

    if (!details) {
      // Should verify if candidate is enrolled strictly?
      // Assuming enrolled check done by UI context or previous calls.
      return res.status(200).json({ files: [] });
    }

    // Yet we need the primary key 'id' of courses_enrollment to query hotel_files (ce_id)
    // The DAO method logic: SELECT venue_name... FROM courses_enrollment ...
    // It SHOULD select 'id' too. I need to update DAO to select 'id'.
    // Start with a separate query or update DAO.
    // Let's assume I'll update DAO.

    // Fetch files
    // details now includes 'id' which is the course_enrollment id
    const files = await HotelFilesDao.getFilesByEnrollmentId(details.id);

    res.status(200).json({ ...details, files });
  } catch (error) {
    console.error("Error fetching venue:", error);
    res
      .status(500)
      .json({ message: "Error fetching venue", error: error.message });
  }
};

exports.updateCandidateVenue = async (req, res) => {
  try {
    const { id: courseId, candidateId } = req.params;
    const {
      venue_name,
      venue_address,
      venue_contact,
      venue_map_link,
      venue_email,
      offline_date,
      remarks,
    } = req.body;

    // Update venue details
    await CourseEnrollmentDao.updateVenueDetails(courseId, candidateId, {
      venue_name,
      venue_address,
      venue_contact,
      venue_map_link,
      venue_email,
      offline_date,
      remarks,
    });

    // Handle File Uploads
    if (req.files && req.files.length > 0) {
      // Get enrollment id
      const enrollment =
        await CourseEnrollmentDao.getEnrolledCandidates(courseId);
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

    res.status(200).json({ message: "Venue details updated" });
  } catch (error) {
    console.error("Error updating venue:", error);
    res
      .status(500)
      .json({ message: "Failed to update venue", error: error.message });
  }
};

// ==========================================
// Attendance Tab
// ==========================================

exports.getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const attendanceData = await CourseEnrollmentDao.getAttendanceData(id);
    res.status(200).json({
      candidates: attendanceData,
      start_date: course.start_date,
      end_date: course.end_date,
    });
  } catch (error) {
    console.error("Error getting attendance:", error);
    res
      .status(500)
      .json({ message: "Failed to get attendance", error: error.message });
  }
};

exports.saveAttendanceSingle = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, date, status, reason } = req.body;
    const result = await CourseEnrollmentDao.saveAttendanceSingle(
      id,
      candidateId,
      date,
      status,
      reason,
    );
    if (result) {
      res.status(200).json({ message: "Attendance updated" });
    } else {
      res.status(400).json({ message: "Failed to update attendance" });
    }
  } catch (error) {
    console.error("Error saving attendance:", error);
    res
      .status(500)
      .json({ message: "Failed to save attendance", error: error.message });
  }
};

exports.saveAbsentReason = async (req, res) => {
  try {
    const { id } = req.params;
    const { absentReasons, status } = req.body;
    const result = await CourseEnrollmentDao.saveAbsentReason(
      id,
      absentReasons,
      status,
    );
    if (result) {
      res.status(200).json({ message: "Absent reasons saved" });
    } else {
      res.status(400).json({ message: "Failed to save some absent reasons" });
    }
  } catch (error) {
    console.error("Error saving absent reason:", error);
    res
      .status(500)
      .json({ message: "Failed to save absent reason", error: error.message });
  }
};

// ==========================================
// Assessment Tab
// ==========================================

exports.getAssessmentScores = async (req, res) => {
  try {
    const { id } = req.params;
    const scores = await CourseEnrollmentDao.getAssessmentScores(id);
    res.status(200).json({ candidates: scores });
  } catch (error) {
    console.error("Error getting assessment scores:", error);
    res.status(500).json({
      message: "Failed to get assessment scores",
      error: error.message,
    });
  }
};

exports.sendAssessmentEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, assessmentId } = req.body;

    const pool = require("../config/db");

    const [candidateRows] = await pool.execute(
      "SELECT u.first_name, u.last_name, u.email FROM users u WHERE u.id = ?",
      [candidateId],
    );
    if (!candidateRows.length || !candidateRows[0].email) {
      return res.status(400).json({ message: "Candidate email not found." });
    }
    const candidate = candidateRows[0];
    const candidateName = `${candidate.first_name} ${candidate.last_name}`;

    const [courseRows] = await pool.execute(
      "SELECT course_name FROM courses WHERE id = ?",
      [id],
    );
    const courseName = courseRows.length
      ? courseRows[0].course_name
      : "Unknown";

    const [assessmentRows] = await pool.execute(
      "SELECT type_of_test FROM assessment WHERE id = ?",
      [assessmentId],
    );
    let typeOfTest = "N/A";
    if (assessmentRows.length) {
      const testType = assessmentRows[0].type_of_test;
      if (testType === "Pre" || testType === "1") typeOfTest = "Pre Course";
      else if (testType === "Post" || testType === "2")
        typeOfTest = "Post Course";
      else if (testType === "Daily" || testType === "3") typeOfTest = "Daily";
      else typeOfTest = testType;
    }

    const [scoreRows] = await pool.execute(
      "SELECT score FROM assessment_results WHERE assessment_id = ? AND candidate_id = ? AND course_id = ? AND status = 'Completed' ORDER BY attempt_number DESC LIMIT 1",
      [assessmentId, candidateId, id],
    );
    const score = scoreRows.length ? scoreRows[0].score : 0;

    const html = getAssessmentResultTemplate(
      candidateName,
      courseName,
      typeOfTest,
      score,
    );
    const subject = `Assessment Results for ${courseName}`;

    await emailService.sendEmail(candidate.email, subject, html);

    res.status(200).json({
      status: true,
      message: "Assessment Results Email Sent Successfully!",
    });
  } catch (error) {
    console.error("Error sending assessment email:", error);
    res.status(500).json({
      status: false,
      message: "Failed to Send Assessment Results Email.",
      error: error.message,
    });
  }
};

// ==========================================
// Feedback Tab
// ==========================================

exports.getFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await CourseEnrollmentDao.getFeedbackStatus(id);
    res.status(200).json({ candidates: status });
  } catch (error) {
    console.error("Error getting feedback status:", error);
    res
      .status(500)
      .json({ message: "Failed to get feedback status", error: error.message });
  }
};

// ==========================================
// Certificate Tab
// ==========================================

exports.getCertificateData = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await ActiveCourseDao.getById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const data = await CourseEnrollmentDao.getCertificateData(id);
    res.status(200).json({
      candidates: data,
      start_date: course.start_date,
      end_date: course.end_date,
    });
  } catch (error) {
    console.error("Error getting certificate data:", error);
    res.status(500).json({
      message: "Failed to get certificate data",
      error: error.message,
    });
  }
};

exports.generateCertificate = async (req, res) => {
  try {
    const { id: activeCourseId } = req.params;
    const { candidateId, issueDate } = req.body;

    if (!activeCourseId || !candidateId) {
      return res
        .status(400)
        .json({ message: "Active Course ID and Candidate ID are required" });
    }

    // Check if certificate already exists
    const existing = await CertificateDao.getByCandidateAndCourse(
      candidateId,
      activeCourseId,
    );
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Certificate already exists",
        certificate_id: existing.id,
      });
    }

    // Fetch details for generation
    const course = await ActiveCourseDao.getById(activeCourseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const masterCourse = await MasterCourseDao.getById(course.master_course_id);
    if (!masterCourse)
      return res.status(404).json({ message: "Master Course not found" });

    const [candidateRows] = await pool.execute(
      "SELECT first_name, last_name, nationality FROM users WHERE id = ?",
      [candidateId],
    );
    if (candidateRows.length === 0)
      return res.status(404).json({ message: "Candidate not found" });
    const candidate = candidateRows[0];

    const trainer = await trainerDao.getTrainerById(course.primary_trainer_id);
    if (!trainer) return res.status(404).json({ message: "Trainer not found" });

    const type = masterCourse.certificate_type || "Others";
    const topic = course.topic;
    const generationDate = issueDate || new Date().toISOString().slice(0, 10);
    const year = new Date(generationDate).getFullYear();

    let certificate_no = "";
    let subid = 0;

    if (type === "Others" || type === "DNV-ST0029" || type === "DNV-ST008") {
      subid = await CertificateDao.getNextSubId(topic, year);
      const subidStr = subid.toString().padStart(4, "0");
      const shortDate =
        new Date(generationDate).toISOString().slice(2, 4) +
        new Date(generationDate).toISOString().slice(5, 7);
      certificate_no = `${topic.toUpperCase()}/${shortDate}/${subidStr}`;
    } else {
      // LNG Certificate logic
      subid = await CertificateDao.getNextSubIdByType(type);
      const subidStr = subid.toString().padStart(4, "0");
      const trainerNation = (trainer.nationality || "UN")
        .toUpperCase()
        .substring(0, 2);
      const candidateNation = (candidate.nationality || "UN")
        .toUpperCase()
        .substring(0, 2);
      certificate_no = `MOLTC (${trainerNation})- LNG${year}-(${candidateNation})${subidStr}`;
    }

    const certificateData = {
      certificate_no,
      type,
      topic,
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
      days: course.no_of_days,
      issue_date: generationDate,
      show_logo: 1,
      is_manual: 0,
      description1: masterCourse.description,
      remarks: "",
      subid,
    };

    const newCertificate = await CertificateDao.create(certificateData);

    // Update Course Enrollment
    await CourseEnrollmentDao.generateCertificate(
      activeCourseId,
      candidateId,
      newCertificate.id,
    );

    res.status(200).json({
      success: true,
      message: "Certificate generated",
      certificate_id: newCertificate.id,
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate certificate",
      error: error.message,
    });
  }
};

exports.updateCertificateActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { candidateId, value } = req.body;
    const result = await CourseEnrollmentDao.updateCertificateActive(
      id,
      candidateId,
      value,
    );

    // Also update certificates table if certificate exists
    const cert = await CertificateDao.getByCandidateAndCourse(candidateId, id);
    if (cert) {
      await CertificateDao.update(cert.id, { status: value === 1 ? 0 : 1 }); // enrollment active=1 means cert status=0 (valid)
    }

    if (result) {
      res
        .status(200)
        .json({ success: true, message: "Certificate status updated" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Failed to update status" });
    }
  } catch (error) {
    console.error("Error updating certificate active:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update certificate status",
      error: error.message,
    });
  }
};
