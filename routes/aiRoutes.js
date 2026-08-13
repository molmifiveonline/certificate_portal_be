const express = require("express");
const router = express.Router();
const { generateQuestions } = require("../controllers/aiQuestionController");
const { protect } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

router.use(protect);

router.post(
  "/generate-questions",
  checkPermission("view_questions"),
  generateQuestions,
);

module.exports = router;
