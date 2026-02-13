const express = require("express");
const router = express.Router();
const feedbackQuestionController = require("../controllers/feedbackQuestionController");

router.post("/", feedbackQuestionController.createFeedbackQuestion);
router.get("/", feedbackQuestionController.getFeedbackQuestions);
router.get("/:id", feedbackQuestionController.getFeedbackQuestionById);
router.put("/:id", feedbackQuestionController.updateFeedbackQuestion);
router.delete("/:id", feedbackQuestionController.deleteFeedbackQuestion);

module.exports = router;
