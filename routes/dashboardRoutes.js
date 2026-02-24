const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");

// All dashboard routes should be protected
router.get("/stats", authMiddleware, dashboardController.getStats);
router.get("/courses", authMiddleware, dashboardController.getCourses);
router.get("/expiry", authMiddleware, dashboardController.getExpiryAlerts);

module.exports = router;
