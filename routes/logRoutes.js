const express = require("express");
const router = express.Router();
const logController = require("../controllers/logController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All log routes require authentication
router.use(protect);

// Create log
router.post("/", checkPermission("view_activity_logs"), logController.createLog);

// Get logs - admin only
router.get("/", checkPermission("view_activity_logs"), logController.getLogs);

// Delete log - admin only
router.delete("/:id", checkPermission("view_activity_logs"), logController.deleteLog);

module.exports = router;
