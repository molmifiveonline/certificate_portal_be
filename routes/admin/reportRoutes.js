const express = require("express");
const router = express.Router();
const ReportController = require("../../controllers/admin/ReportController");
// potentially add auth middleware if needed, e.g. authenticateUser or similar
// const { authenticateUser } = require('../../middleware/authMiddleware');

router.get("/filter-options", ReportController.getFilterOptions);
router.post("/feedback/export", ReportController.exportFeedbackReport);
router.post("/certificate/export", ReportController.exportCertificateReport);

module.exports = router;
