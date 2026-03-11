const express = require("express");
const router = express.Router();
const controller = require("../controllers/preActiveCourseController");
const syncController = require("../controllers/preActiveCourseSyncController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// Public portal routes (using custom tokens)
router.get("/public/token/:token", controller.getCourseByToken);
router.post("/public/token/:token/nominate", controller.nominatorAddCandidate);
router.post(
  "/public/token/:token/candidate-approval",
  controller.candidateApproval,
);

// Admin / protected routes
router.use(verifyToken);

router.post(
  "/",
  checkPermission("create_pre_active_course"),
  controller.createCourse,
);
router.get(
  "/",
  checkPermission("view_pre_active_courses"),
  controller.getAllCourses,
);
router.post(
  "/fetch-external-preview",
  checkPermission("create_pre_active_course"),
  syncController.fetchExternalPreview,
);
router.post(
  "/confirm-bulk-import",
  checkPermission("create_pre_active_course"),
  syncController.confirmBulkImport,
);
router.get(
  "/report/admin-remarks",
  checkPermission("view_admin_remarks"),
  controller.getAdminRemarksReport,
); // Make sure this is above /:id

router.get(
  "/:id",
  checkPermission("view_pre_active_courses"),
  controller.getCourseById,
);
router.put(
  "/:id",
  checkPermission("edit_pre_active_course"),
  controller.updateCourse,
);
router.delete(
  "/:id",
  checkPermission("delete_pre_active_course"),
  controller.deleteCourse,
);

// Actions on a specific pre-active course
router.post(
  "/:id/notify-nominators",
  checkPermission("edit_pre_active_course"),
  controller.notifyNominators,
);
router.post(
  "/:id/notify-candidates",
  checkPermission("edit_pre_active_course"),
  controller.notifyCandidates,
);
router.post(
  "/:id/convert",
  checkPermission("edit_pre_active_course"),
  controller.convertToActiveCourse,
);

// Enrolled Candidates and Admin Approvals
router.get(
  "/:id/candidates",
  checkPermission("view_pre_active_courses"),
  controller.getEnrolledCandidates,
);
router.get(
  "/:id/admin-approvals",
  checkPermission("view_pre_active_approvals"),
  controller.getPendingAdminApprovals,
);
router.post(
  "/admin-approval/:enrollmentId",
  checkPermission("edit_pre_active_approval"),
  controller.adminApproval,
);

module.exports = router;
