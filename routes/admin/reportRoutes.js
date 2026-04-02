const express = require("express");
const router = express.Router();
const ReportController = require("../../controllers/admin/ReportController");
const { protect, authorize } = require("../../middleware/authMiddleware");

// All report routes require authentication and admin/superadmin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

router.get("/filter-options", ReportController.getFilterOptions);
router.post("/feedback/export", ReportController.exportFeedbackReport);
router.post(
  "/feedback/bulk-download-pdf",
  ReportController.bulkDownloadFeedbackPDFs,
);
router.post("/certificate/export", ReportController.exportCertificateReport);
router.get("/hotel", ReportController.getHotelReport);

module.exports = router;
