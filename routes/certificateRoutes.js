const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/CertificateController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// Public verification route (no auth required)
router.get("/verify/:id", certificateController.getCertificateVerificationById);

// Admin routes - require auth + admin/superadmin role
router.get(
  "/",
  protect,
  checkPermission("manage_active_course_certificates", ["Trainer", "Candidate"]),
  certificateController.listCertificates,
);
router.get(
  "/:id",
  protect,
  checkPermission("manage_active_course_certificates", ["Candidate", "Trainer"]),
  certificateController.getCertificateById,
);
router.post(
  "/",
  protect,
  checkPermission("manage_active_course_certificates"),
  certificateController.createManualCertificate,
);
router.post(
  "/generate",
  protect,
  checkPermission("manage_active_course_certificates"),
  certificateController.generateCertificate,
);
router.put(
  "/:id",
  protect,
  checkPermission("manage_active_course_certificates"),
  certificateController.updateCertificate,
);
router.delete(
  "/:id",
  protect,
  checkPermission("manage_active_course_certificates"),
  certificateController.deleteCertificate,
);

module.exports = router;
