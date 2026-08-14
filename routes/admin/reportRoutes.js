const express = require("express");
const router = express.Router();
const ReportController = require("../../controllers/admin/ReportController");
const { protect, authorize } = require("../../middleware/authMiddleware");
const checkPermission = require("../../middleware/permissionMiddleware");

// All report routes require authentication
router.use(protect);

router.get("/filter-options", checkPermission("view_reports"), ReportController.getFilterOptions);
router.post("/ai/dataset", checkPermission("view_reports"), ReportController.getAiReportDataset);
router.post("/ai/chat", checkPermission("view_reports"), ReportController.chatWithReportAi);
router.post("/feedback/export", checkPermission("export_reports"), ReportController.exportFeedbackReport);
router.post("/training-activities/export", checkPermission("export_reports"), ReportController.exportTrainingActivitiesReport);
router.post("/training-record/export", checkPermission("export_reports"), ReportController.exportTrainingRecordReport);
router.post(
  "/feedback/bulk-download-pdf",
  checkPermission("export_reports"),
  ReportController.bulkDownloadFeedbackPDFs,
);
router.post("/certificate/export", checkPermission("export_reports"), ReportController.exportCertificateReport);
router.get("/hotel", checkPermission("view_reports"), ReportController.getHotelReport);

module.exports = router;
