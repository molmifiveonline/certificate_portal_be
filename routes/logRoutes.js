const express = require("express");
const router = express.Router();
const logController = require("../controllers/logController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All log routes require authentication and admin/superadmin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

// Create log
router.post("/", logController.createLog);

// Get logs - admin only
router.get("/", logController.getLogs);

// Delete log - admin only
router.delete("/:id", logController.deleteLog);

module.exports = router;
