const express = require("express");
const router = express.Router();
const reimbursementController = require("../controllers/reimbursementController");
const { protect, authorize } = require("../middleware/authMiddleware");
const reimbursementUpload = require("../middleware/reimbursementUploadMiddleware");
const db = require("../config/db");
const { error } = require("../utils/responseHandler");

const authorizeMolmiCandidate = async (req, res, next) => {
  if (!req.user) {
    return error(res, 401, "User not authenticated");
  }

  let regType = req.user.registration_type;
  if (!regType) {
    const [rows] = await db.query(
      "SELECT registration_type FROM candidate_profiles WHERE user_id = ?",
      [req.user.id]
    );
    regType = rows[0]?.registration_type;
  }

  const isMolmi =
    regType === "MOLMI Employee" ||
    (typeof regType === "string" && regType.toLowerCase().includes("molmi"));

  if (!isMolmi) {
    return error(
      res,
      403,
      "Reimbursements module is only accessible to MOLMI candidates",
    );
  }

  next();
};

router.use(protect, authorize("Candidate"), authorizeMolmiCandidate);

router.get(
  "/my",
  reimbursementController.getMyReimbursements,
);
router.get(
  "/:id",
  reimbursementController.getReimbursementById,
);
router.post(
  "/",
  reimbursementUpload.array("attachments"),
  reimbursementController.createReimbursement,
);
router.put(
  "/:id",
  reimbursementUpload.array("attachments"),
  reimbursementController.updateReimbursement,
);
router.post(
  "/:id/submit",
  reimbursementController.submitReimbursement,
);

module.exports = router;
