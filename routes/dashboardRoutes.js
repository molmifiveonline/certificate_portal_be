const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All dashboard routes should be protected with role-based access
router.get(
  "/stats",
  protect,
  checkPermission("view_active_courses", ["Trainer", "Candidate"]),
  dashboardController.getStats,
);
router.get(
  "/candidate-stats",
  protect,
  authorize("Candidate"),
  dashboardController.getCandidateStats,
);
router.get(
  "/courses",
  protect,
  checkPermission("view_active_courses", ["Trainer", "Candidate"]),
  dashboardController.getCourses,
);
router.get(
  "/expiry",
  protect,
  checkPermission("view_reports"),
  dashboardController.getExpiryAlerts,
);
router.post(
  "/expiry/notify",
  protect,
  checkPermission("view_reports"),
  dashboardController.notifyExpiryCandidate,
);

module.exports = router;
