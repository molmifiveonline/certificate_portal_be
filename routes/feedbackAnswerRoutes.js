const express = require("express");
const router = express.Router();
const FeedbackAnswerController = require("../controllers/FeedbackAnswerController");
const protect = require("../middleware/authMiddleware");

router.post("/submit", FeedbackAnswerController.submitFeedback);
router.get(
  "/status/:courseId",
  protect,
  FeedbackAnswerController.getCandidateFeedbackStatus,
);
router.post(
  "/candidate-submit",
  protect,
  FeedbackAnswerController.submitCandidateFeedback,
);

router.get("/courses", protect, FeedbackAnswerController.getFeedbackCourses);
router.get("/submissions", protect, FeedbackAnswerController.getSubmissions);
router.get(
  "/submissions/:candidateId/:courseId",
  FeedbackAnswerController.getSubmissionDetails,
);
router.get(
  "/download-pdf/:candidateId/:activeCourseId",
  FeedbackAnswerController.downloadFeedbackPDF,
);

module.exports = router;
