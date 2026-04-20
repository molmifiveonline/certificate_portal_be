const express = require("express");
const router = express.Router();
const reimbursementController = require("../../controllers/reimbursementController");
const { protect, authorize } = require("../../middleware/authMiddleware");
const checkPermission = require("../../middleware/permissionMiddleware");

router.get(
  "/",
  protect,
  checkPermission("view_reimbursements"),
  reimbursementController.getAdminReimbursements,
);
router.get(
  "/:id",
  protect,
  checkPermission("view_reimbursements"),
  reimbursementController.getAdminReimbursementById,
);
router.post(
  "/:id/approve",
  protect,
  checkPermission("manage_reimbursements"),
  reimbursementController.approveReimbursement,
);
router.post(
  "/:id/disapprove",
  protect,
  checkPermission("manage_reimbursements"),
  reimbursementController.disapproveReimbursement,
);
router.post(
  "/:id/request-resubmission",
  protect,
  checkPermission("manage_reimbursements"),
  reimbursementController.requestResubmission,
);
router.post(
  "/:id/resend-approved-email",
  protect,
  checkPermission("manage_reimbursements"),
  reimbursementController.resendApprovedEmail,
);

module.exports = router;
