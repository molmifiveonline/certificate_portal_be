const express = require("express");
const router = express.Router();
const controller = require("../controllers/outhouseCourseController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const outhouseUpload = require("../middleware/outhouseUploadMiddleware");

router.post("/acknowledge-enrollment", controller.acknowledgeEnrollment);

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
  checkPermission("view_outhouse_courses"),
  controller.createCourse,
);
router.get(
  "/",
  checkPermission("view_outhouse_courses"),
  controller.getAllCourses,
);
router.get(
  "/:id",
  checkPermission("view_outhouse_courses"),
  controller.getCourseById,
);
router.put(
  "/:id",
  checkPermission("view_outhouse_courses"),
  controller.updateCourse,
);

router.get(
  "/:id/candidates",
  checkPermission("view_outhouse_courses"),
  controller.getCandidates,
);
router.get(
  "/:id/candidate-options",
  checkPermission("view_outhouse_courses"),
  controller.getCandidateOptions,
);
router.post(
  "/:id/candidates",
  checkPermission("view_outhouse_courses"),
  controller.addCandidates,
);
router.put(
  "/:id/candidates/:candidateId",
  checkPermission("view_outhouse_courses"),
  controller.updateCandidate,
);
router.delete(
  "/:id/candidates/:candidateId",
  checkPermission("view_outhouse_courses"),
  controller.deleteCandidate,
);
router.post(
  "/:id/candidates/:candidateId/welcome-letter",
  checkPermission("view_outhouse_courses"),
  controller.sendWelcomeLetter,
);
router.post(
  "/:id/candidates/:candidateId/venue-details",
  checkPermission("view_outhouse_courses"),
  outhouseUpload.array("documents"),
  controller.updateVenueDetails,
);

router.get(
  "/:id/attendance",
  checkPermission("view_outhouse_courses"),
  controller.getAttendance,
);
router.post(
  "/:id/attendance",
  checkPermission("view_outhouse_courses"),
  controller.saveAttendance,
);

router.get(
  "/:id/feedback",
  checkPermission("view_outhouse_courses"),
  controller.getFeedback,
);
router.post(
  "/:id/feedback/document",
  checkPermission("view_outhouse_courses"),
  outhouseUpload.single("feedback_document"),
  controller.uploadFeedbackDocument,
);
router.post(
  "/:id/feedback/:candidateId/resend",
  checkPermission("view_outhouse_courses"),
  controller.resendFeedback,
);

router.get(
  "/:id/certificates",
  checkPermission("view_outhouse_courses"),
  controller.getCertificates,
);
router.post(
  "/:id/certificates/:candidateId",
  checkPermission("view_outhouse_courses"),
  outhouseUpload.single("certificate_file"),
  controller.saveCertificate,
);

module.exports = router;
