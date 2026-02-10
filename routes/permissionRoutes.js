const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All permission routes require authentication
router.use(verifyToken);

// Manage Permissions typically requires a high-level permission itself
// Let's protect these with 'manage_permissions'
router.get(
  "/permissions",
  checkPermission("manage_permissions"),
  permissionController.getAllPermissions,
);
router.get(
  "/roles",
  checkPermission("manage_permissions"),
  permissionController.getAllRoles,
);
router.get(
  "/role/:roleId",
  checkPermission("manage_permissions"),
  permissionController.getRolePermissions,
);
router.post(
  "/role/:roleId",
  checkPermission("manage_permissions"),
  permissionController.updateRolePermissions,
);

module.exports = router;
