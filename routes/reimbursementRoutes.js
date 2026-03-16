const express = require("express");
const router = express.Router();
const reimbursementController = require("../controllers/reimbursementController");
const { protect, authorize } = require("../middleware/authMiddleware");
const reimbursementUpload = require("../middleware/reimbursementUploadMiddleware");

router.get(
  "/my",
  protect,
  authorize("Candidate"),
  reimbursementController.getMyReimbursements,
);
router.get(
  "/:id",
  protect,
  authorize("Candidate"),
  reimbursementController.getReimbursementById,
);
router.post(
  "/",
  protect,
  authorize("Candidate"),
  reimbursementUpload.array("attachments"),
  reimbursementController.createReimbursement,
);
router.put(
  "/:id",
  protect,
  authorize("Candidate"),
  reimbursementUpload.array("attachments"),
  reimbursementController.updateReimbursement,
);
router.post(
  "/:id/submit",
  protect,
  authorize("Candidate"),
  reimbursementController.submitReimbursement,
);

module.exports = router;
