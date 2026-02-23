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
  exportSubmittedAssessments,
  getAssessmentsByCourse,
  getAssessmentSubmissions,
} = require("../controllers/assessmentController");
const verifyToken = require("../middleware/authMiddleware");

// CRUD routes
router.post("/create", verifyToken, createAssessment);
router.get("/", verifyToken, getAllAssessments);
router.get("/courses", verifyToken, getActiveCourses);
router.get("/candidates/:courseId", verifyToken, getCandidatesByCourse);
router.get("/questions/:courseId", verifyToken, getQuestionsByCourse);

// Submitted Assessment routes
router.get("/export-submitted", verifyToken, exportSubmittedAssessments);
router.get("/submitted-courses", verifyToken, getSubmittedCourses);
router.get("/course/:courseId/submissions", verifyToken, getCourseSubmissions);
router.get(
  "/course/:courseId/assessments",
  verifyToken,
  getAssessmentsByCourse,
);
router.get(
  "/assessment/:assessmentId/submissions",
  verifyToken,
  getAssessmentSubmissions,
);
router.get("/submission/:resultId", verifyToken, getSubmissionDetail);

router.get("/:id", verifyToken, getAssessmentById);
router.put("/update/:id", verifyToken, updateAssessment);
router.delete("/delete/:id", verifyToken, deleteAssessment);

module.exports = router;
