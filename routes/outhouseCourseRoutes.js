const express = require("express");
const router = express.Router();
const controller = require("../controllers/outhouseCourseController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const outhouseUpload = require("../middleware/outhouseUploadMiddleware");

router.use(verifyToken);

router.get(
  "/master-course-options",
  checkPermission("view_master_courses"),
  controller.getMasterCourseOptions,
);
router.get(
  "/pre-active-options",
  checkPermission("view_pre_active_courses"),
  controller.getPreActiveOptions,
);

router.post(
  "/",
  checkPermission("view_master_courses"),
  controller.createCourse,
);
router.get(
  "/",
  checkPermission("view_master_courses"),
  controller.getAllCourses,
);
router.get(
  "/:id",
  checkPermission("view_master_courses"),
  controller.getCourseById,
);
router.put(
  "/:id",
  checkPermission("view_master_courses"),
  controller.updateCourse,
);

router.get(
  "/:id/candidates",
  checkPermission("view_candidates"),
  controller.getCandidates,
);
router.get(
  "/:id/candidate-options",
  checkPermission("view_candidates"),
  controller.getCandidateOptions,
);
router.post(
  "/:id/candidates",
  checkPermission("view_candidates"),
  controller.addCandidates,
);
router.put(
  "/:id/candidates/:candidateId",
  checkPermission("view_candidates"),
  controller.updateCandidate,
);
router.delete(
  "/:id/candidates/:candidateId",
  checkPermission("view_candidates"),
  controller.deleteCandidate,
);
router.post(
  "/:id/candidates/:candidateId/welcome-letter",
  checkPermission("view_candidates"),
  controller.sendWelcomeLetter,
);
router.post(
  "/:id/candidates/:candidateId/venue-details",
  checkPermission("view_candidates"),
  outhouseUpload.array("documents"),
  controller.updateVenueDetails,
);

router.get(
  "/:id/attendance",
  checkPermission("view_candidates"),
  controller.getAttendance,
);
router.post(
  "/:id/attendance",
  checkPermission("view_candidates"),
  controller.saveAttendance,
);

router.get(
  "/:id/feedback",
  checkPermission("view_candidates"),
  controller.getFeedback,
);
router.post(
  "/:id/feedback/document",
  checkPermission("view_candidates"),
  outhouseUpload.single("feedback_document"),
  controller.uploadFeedbackDocument,
);
router.post(
  "/:id/feedback/:candidateId/resend",
  checkPermission("view_candidates"),
  controller.resendFeedback,
);

router.get(
  "/:id/certificates",
  checkPermission("view_candidates"),
  controller.getCertificates,
);
router.post(
  "/:id/certificates/:candidateId",
  checkPermission("view_candidates"),
  outhouseUpload.single("certificate_file"),
  controller.saveCertificate,
);

module.exports = router;
