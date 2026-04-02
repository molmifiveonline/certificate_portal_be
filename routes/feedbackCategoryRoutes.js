const express = require("express");
const router = express.Router();
const feedbackCategoryController = require("../controllers/feedbackCategoryController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All feedback category routes require authentication and admin/superadmin role
router.use(protect);

router.post(
  "/",
  authorize("Admin", "SuperAdmin"),
  feedbackCategoryController.createFeedbackCategory,
);
router.get(
  "/",
  authorize("Admin", "SuperAdmin"),
  feedbackCategoryController.getFeedbackCategories,
);
router.get(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackCategoryController.getFeedbackCategoryById,
);
router.put(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackCategoryController.updateFeedbackCategory,
);
router.delete(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  feedbackCategoryController.deleteFeedbackCategory,
);

module.exports = router;
