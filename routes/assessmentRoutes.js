const express = require("express");
const router = express.Router();
const {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  getActiveCourses,
  getCandidatesByCourse,
  getQuestionsByCourse,
  getSubmittedCourses,
  getCourseSubmissions,
  getSubmissionDetail,
  downloadSubmissionById,
  exportSubmittedAssessments,
  getAssessmentsByCourse,
  getAssessmentSubmissions,
  getPaginatedSubmissions,
  getPlayAssessmentQuestions,
  getCandidateAssessmentsByCourse,
  submitAssessment,
} = require("../controllers/assessmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All assessment routes require authentication
router.use(protect);

// Admin/Trainer CRUD routes
router.post(
  "/create",
  authorize("Admin", "SuperAdmin", "Trainer"),
  createAssessment,
);
router.get(
  "/",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getAllAssessments,
);
router.get(
  "/courses",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getActiveCourses,
);
router.get(
  "/candidates/:courseId",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getCandidatesByCourse,
);
router.get(
  "/questions/:courseId",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getQuestionsByCourse,
);

// Submitted Assessment routes - Admin/Trainer
router.get(
  "/export-submitted",
  authorize("Admin", "SuperAdmin"),
  exportSubmittedAssessments,
);
router.get(
  "/submitted-courses",
  authorize("Admin", "SuperAdmin"),
  getSubmittedCourses,
);
router.get(
  "/all-submissions",
  authorize("Admin", "SuperAdmin"),
  getPaginatedSubmissions,
);
router.get(
  "/course/:courseId/submissions",
  authorize("Admin", "SuperAdmin"),
  getCourseSubmissions,
);
router.get(
  "/course/:courseId/assessments",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getAssessmentsByCourse,
);
router.get(
  "/assessment/:assessmentId/submissions",
  authorize("Admin", "SuperAdmin"),
  getAssessmentSubmissions,
);
router.get(
  "/submission/:resultId/download",
  authorize("Admin", "SuperAdmin", "Candidate"),
  downloadSubmissionById,
);
router.get(
  "/submission/:resultId",
  authorize("Admin", "SuperAdmin", "Candidate"),
  getSubmissionDetail,
);

// Candidate endpoints
router.get(
  "/:id/play-questions",
  authorize("Admin", "SuperAdmin", "Candidate"),
  getPlayAssessmentQuestions,
);
router.get(
  "/course/:courseId/candidate-list",
  authorize("Admin", "SuperAdmin", "Candidate"),
  getCandidateAssessmentsByCourse,
);
router.post(
  "/submit",
  authorize("Admin", "SuperAdmin", "Candidate"),
  submitAssessment,
);

router.get(
  "/:id",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getAssessmentById,
);
router.put(
  "/update/:id",
  authorize("Admin", "SuperAdmin", "Trainer"),
  updateAssessment,
);
router.delete(
  "/delete/:id",
  authorize("Admin", "SuperAdmin"),
  deleteAssessment,
);

module.exports = router;
