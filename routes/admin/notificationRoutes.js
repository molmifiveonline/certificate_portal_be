const express = require("express");
const notificationController = require("../../controllers/admin/notificationController");
const { protect, authorize } = require("../../middleware/authMiddleware");
const checkPermission = require("../../middleware/permissionMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  checkPermission("view_admin_notifications"),
  notificationController.getAdminNotifications,
);

module.exports = router;
