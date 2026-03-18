const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/CertificateController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, certificateController.listCertificates);
router.get("/verify/:id", certificateController.getCertificateVerificationById);
router.get("/:id", authMiddleware, certificateController.getCertificateById);
router.post("/", authMiddleware, certificateController.createManualCertificate);
router.post(
  "/generate",
  authMiddleware,
  certificateController.generateCertificate,
);
router.put("/:id", authMiddleware, certificateController.updateCertificate);
router.delete("/:id", authMiddleware, certificateController.deleteCertificate);

module.exports = router;
