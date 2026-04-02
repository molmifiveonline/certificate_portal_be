const express = require("express");
const router = express.Router();
const FeedbackAnswerController = require("../controllers/FeedbackAnswerController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Public submit route (used by feedback form links sent to candidates)
router.post("/submit", FeedbackAnswerController.submitFeedback);

// Candidate-specific routes
router.get(
  "/status/:courseId",
  protect,
  authorize("Admin", "SuperAdmin", "Candidate"),
  FeedbackAnswerController.getCandidateFeedbackStatus,
);
router.post(
  "/candidate-submit",
  protect,
  authorize("Candidate"),
  FeedbackAnswerController.submitCandidateFeedback,
);

// Admin/Trainer routes for viewing feedback data
router.get(
  "/courses",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  FeedbackAnswerController.getFeedbackCourses,
);
router.get(
  "/submissions",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  FeedbackAnswerController.getSubmissions,
);
router.get(
  "/submissions/:candidateId/:courseId",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  FeedbackAnswerController.getSubmissionDetails,
);
router.get(
  "/download-pdf/:candidateId/:activeCourseId",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  FeedbackAnswerController.downloadFeedbackPDF,
);

module.exports = router;
