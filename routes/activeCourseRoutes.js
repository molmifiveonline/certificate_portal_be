const express = require("express");
const router = express.Router();
const activeCourseController = require("../controllers/activeCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const venueUpload = require("../middleware/venueUploadMiddleware");

router.post(
  "/",
  protect,
  checkPermission("create_active_course", ["Trainer"]),
  activeCourseController.createCourse,
);
router.get(
  "/",
  protect,
  checkPermission("view_active_courses", ["Trainer", "Candidate"]),
  activeCourseController.getAllCourses,
);
router.get(
  "/:id",
  protect,
  checkPermission("view_active_courses", ["Trainer", "Candidate"]),
  activeCourseController.getCourseById,
);
router.put(
  "/:id",
  protect,
  checkPermission("edit_active_course", ["Trainer"]),
  activeCourseController.updateCourse,
);
router.delete(
  "/:id",
  protect,
  checkPermission("delete_active_course"),
  activeCourseController.deleteCourse,
);

// Attendance Routes
router.get(
  "/:id/my-attendance",
  protect,
  checkPermission([], ["Candidate"]),
  activeCourseController.getCandidateAttendance,
);

// Course Operations
router.post(
  "/:id/cancel",
  protect,
  checkPermission("cancel_active_course"),
  activeCourseController.cancelCourse,
);
router.post(
  "/:id/complete",
  protect,
  checkPermission("complete_active_course"),
  activeCourseController.completeCourse,
);

// Candidate Enrollment Routes
router.get(
  "/:id/candidates",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  activeCourseController.getEnrolledCandidates,
);
router.post(
  "/:id/candidates",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  activeCourseController.enrollCandidates,
);
router.delete(
  "/:id/candidates/:candidateId",
  protect,
  checkPermission("manage_active_course_enrollment"),
  activeCourseController.removeCandidate,
);
router.put(
  "/:id/candidates/:candidateId/status-pool",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  activeCourseController.updateStatusPool,
);
router.put(
  "/:id/candidates/:candidateId/observer",
  protect,
  checkPermission("manage_active_course_enrollment"),
  activeCourseController.updateObserverStatus,
);
router.get(
  "/:id/available-candidates",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  activeCourseController.getAvailableCandidates,
);

router.post(
  "/acknowledge-enrollment",
  activeCourseController.acknowledgeEnrollment,
);

// Email Operations
router.post(
  "/:id/email-primary-trainer",
  protect,
  checkPermission("edit_active_course", ["Trainer"]),
  activeCourseController.emailPrimaryTrainer,
);
router.post(
  "/:id/candidates/:candidateId/email",
  protect,
  checkPermission("edit_active_course", ["Trainer"]),
  activeCourseController.emailCandidate,
);
router.post(
  "/:id/candidates/email/bulk",
  protect,
  checkPermission("edit_active_course", ["Trainer"]),
  activeCourseController.emailCandidatesBulk,
);

// Venue Operations (Offline Courses)
router.get(
  "/:id/candidates/:candidateId/venue",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  activeCourseController.getCandidateVenue,
);
router.post(
  "/:id/candidates/:candidateId/venue",
  protect,
  checkPermission("manage_active_course_enrollment", ["Trainer"]),
  venueUpload.array("venue_files"),
  activeCourseController.updateCandidateVenue,
);

// Attendance Tab
router.get(
  "/:id/attendance",
  protect,
  checkPermission("manage_active_course_attendance", ["Trainer"]),
  activeCourseController.getAttendance,
);
router.post(
  "/:id/attendance/single",
  protect,
  checkPermission("manage_active_course_attendance", ["Trainer"]),
  activeCourseController.saveAttendanceSingle,
);
router.post(
  "/:id/attendance/absent-reason",
  protect,
  checkPermission("manage_active_course_attendance", ["Trainer"]),
  activeCourseController.saveAbsentReason,
);

// Assessment Tab
router.get(
  "/:id/assessment-scores",
  protect,
  checkPermission("manage_active_course_assessment", ["Trainer"]),
  activeCourseController.getAssessmentScores,
);
router.get(
  "/:id/training-report",
  protect,
  checkPermission("manage_active_course_assessment", ["Trainer"]),
  activeCourseController.generateTrainingReport,
);
router.post(
  "/:id/email/assessment",
  protect,
  checkPermission("manage_active_course_assessment", ["Trainer"]),
  activeCourseController.sendAssessmentEmail,
);

router.put(
  "/:id/trainer-comment",
  protect,
  checkPermission("manage_active_course_assessment", ["Trainer"]),
  activeCourseController.updateTrainerComment,
);

// Feedback Tab
router.get(
  "/:id/feedback-status",
  protect,
  checkPermission("manage_active_course_feedback", ["Trainer"]),
  activeCourseController.getFeedbackStatus,
);
router.post(
  "/:id/email/feedback",
  protect,
  checkPermission("manage_active_course_feedback", ["Trainer"]),
  activeCourseController.sendFeedbackEmail,
);

// Certificate Tab
router.get(
  "/:id/certificates",
  protect,
  checkPermission("manage_active_course_certificates", ["Trainer"]),
  activeCourseController.getCertificateData,
);
router.post(
  "/:id/certificates/generate",
  protect,
  checkPermission("manage_active_course_certificates", ["Trainer"]),
  activeCourseController.generateCertificate,
);
router.put(
  "/:id/certificates/active",
  protect,
  checkPermission("manage_active_course_certificates", ["Trainer"]),
  activeCourseController.updateCertificateActive,
);
router.put(
  "/:id/certificates/:certificateId/hide",
  protect,
  checkPermission("manage_active_course_certificates", ["Trainer"]),
  activeCourseController.updateCertificateHide,
);

module.exports = router;
