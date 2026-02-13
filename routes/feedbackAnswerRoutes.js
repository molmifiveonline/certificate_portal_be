const express = require("express");
const router = express.Router();
const FeedbackAnswerController = require("../controllers/FeedbackAnswerController");

router.post("/submit", FeedbackAnswerController.submitFeedback);
router.get("/submissions", FeedbackAnswerController.getSubmissions);
router.get(
  "/submissions/:candidateId/:courseId",
  FeedbackAnswerController.getSubmissionDetails,
);

module.exports = router;
