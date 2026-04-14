const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/CertificateController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Public verification route (no auth required)
router.get("/verify/:id", certificateController.getCertificateVerificationById);

// Admin routes - require auth + admin/superadmin role
router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  certificateController.listCertificates,
);
router.get(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin", "Candidate", "Trainer"),
  certificateController.getCertificateById,
);
router.post(
  "/",
  protect,
  authorize("Admin", "SuperAdmin"),
  certificateController.createManualCertificate,
);
router.post(
  "/generate",
  protect,
  authorize("Admin", "SuperAdmin"),
  certificateController.generateCertificate,
);
router.put(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  certificateController.updateCertificate,
);
router.delete(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  certificateController.deleteCertificate,
);

module.exports = router;
