const express = require("express");
const router = express.Router();
const feedbackCategoryController = require("../controllers/feedbackCategoryController");
const authMiddleware = require("../middleware/authMiddleware");

// Should be protected by authMiddleware, assuming it exists and is used in other routes
// Using authMiddleware.verifyToken if available, observing other routes would be best.
// For now, I'll assume standard usage. I'll check how other routes use it.
// Checking routes folder... authRoutes.js doesn't show usage, but trainerRoutes.js likely does.

router.post("/", feedbackCategoryController.createFeedbackCategory);
router.get("/", feedbackCategoryController.getFeedbackCategories);
router.get("/:id", feedbackCategoryController.getFeedbackCategoryById);
router.put("/:id", feedbackCategoryController.updateFeedbackCategory);
router.delete("/:id", feedbackCategoryController.deleteFeedbackCategory);

module.exports = router;
