const express = require("express");
const router = express.Router();
const activeCourseController = require("../controllers/activeCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");
const venueUpload = require("../middleware/venueUploadMiddleware");

router.post(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.createCourse,
);
router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  activeCourseController.getAllCourses,
);
router.get(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  activeCourseController.getCourseById,
);
router.put(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.updateCourse,
);
router.delete(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.deleteCourse,
);

// Attendance Routes
router.get(
  "/:id/my-attendance",
  protect,
  authorize("Candidate"),
  activeCourseController.getCandidateAttendance,
);

// Course Operations
router.post(
  "/:id/cancel",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.cancelCourse,
);
router.post(
  "/:id/complete",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.completeCourse,
);

// Candidate Enrollment Routes
router.get(
  "/:id/candidates",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getEnrolledCandidates,
);
router.post(
  "/:id/candidates",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.enrollCandidates,
);
router.delete(
  "/:id/candidates/:candidateId",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.removeCandidate,
);
router.put(
  "/:id/candidates/:candidateId/status-pool",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.updateStatusPool,
);
router.get(
  "/:id/available-candidates",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
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
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.emailPrimaryTrainer,
);
router.post(
  "/:id/candidates/:candidateId/email",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.emailCandidate,
);

// Venue Operations (Offline Courses)
router.get(
  "/:id/candidates/:candidateId/venue",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getCandidateVenue,
);
router.post(
  "/:id/candidates/:candidateId/venue",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  venueUpload.array("venue_files"),
  activeCourseController.updateCandidateVenue,
);

// Attendance Tab
router.get(
  "/:id/attendance",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getAttendance,
);
router.post(
  "/:id/attendance/single",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.saveAttendanceSingle,
);
router.post(
  "/:id/attendance/absent-reason",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.saveAbsentReason,
);

// Assessment Tab
router.get(
  "/:id/assessment-scores",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getAssessmentScores,
);
router.get(
  "/:id/training-report",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.generateTrainingReport,
);
router.post(
  "/:id/email/assessment",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.sendAssessmentEmail,
);

router.put(
  "/:id/trainer-comment",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.updateTrainerComment,
);

// Feedback Tab
router.get(
  "/:id/feedback-status",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getFeedbackStatus,
);
router.post(
  "/:id/email/feedback",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.sendFeedbackEmail,
);

// Certificate Tab
router.get(
  "/:id/certificates",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getCertificateData,
);
router.post(
  "/:id/certificates/generate",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.generateCertificate,
);
router.put(
  "/:id/certificates/active",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.updateCertificateActive,
);
router.put(
  "/:id/certificates/:certificateId/hide",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.updateCertificateHide,
);

module.exports = router;
