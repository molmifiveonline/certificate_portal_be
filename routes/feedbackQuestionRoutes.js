const express = require("express");
const router = express.Router();
const feedbackQuestionController = require("../controllers/feedbackQuestionController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All feedback question routes require authentication and admin/superadmin role
router.use(protect);

router.post(
  "/",
  authorize("Admin", "SuperAdmin"),
  feedbackQuestionController.createFeedbackQuestion,
);
router.get(
  "/",
  authorize("Admin", "SuperAdmin"),
  feedbackQuestionController.getFeedbackQuestions,
);
router.get(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackQuestionController.getFeedbackQuestionById,
);
router.put(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackQuestionController.updateFeedbackQuestion,
);
router.delete(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackQuestionController.deleteFeedbackQuestion,
);

module.exports = router;
