const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All dashboard routes should be protected with role-based access
router.get(
  "/stats",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  dashboardController.getStats,
);
router.get(
  "/courses",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  dashboardController.getCourses,
);
router.get(
  "/expiry",
  protect,
  authorize("Admin", "SuperAdmin"),
  dashboardController.getExpiryAlerts,
);

module.exports = router;
