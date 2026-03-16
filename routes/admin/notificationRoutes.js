const express = require("express");
const notificationController = require("../../controllers/admin/notificationController");
const { protect, authorize } = require("../../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin"),
  notificationController.getAdminNotifications,
);

module.exports = router;
