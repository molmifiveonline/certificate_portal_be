const express = require("express");
const router = express.Router();
const FeedbackFormController = require("../controllers/FeedbackFormController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All feedback form routes require authentication and admin/superadmin role
router.use(protect);

router.post("/", authorize("Admin", "SuperAdmin"), FeedbackFormController.create);
router.get("/", authorize("Admin", "SuperAdmin"), FeedbackFormController.getAll);
router.get("/:id", authorize("Admin", "SuperAdmin"), FeedbackFormController.getById);
router.put("/:id", authorize("Admin", "SuperAdmin"), FeedbackFormController.update);
router.delete("/:id", authorize("Admin", "SuperAdmin"), FeedbackFormController.delete);

module.exports = router;
