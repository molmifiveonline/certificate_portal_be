const express = require("express");
const router = express.Router();
const reimbursementController = require("../../controllers/reimbursementController");
const { protect, authorize } = require("../../middleware/authMiddleware");

router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.getAdminReimbursements,
);
router.get(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.getAdminReimbursementById,
);
router.post(
  "/:id/approve",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.approveReimbursement,
);
router.post(
  "/:id/disapprove",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.disapproveReimbursement,
);
router.post(
  "/:id/request-resubmission",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.requestResubmission,
);
router.post(
  "/:id/resend-approved-email",
  protect,
  authorize("Admin", "SuperAdmin"),
  reimbursementController.resendApprovedEmail,
);

module.exports = router;
