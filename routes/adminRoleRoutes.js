const express = require("express");
const router = express.Router();
const adminRoleController = require("../controllers/adminRoleController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All admin role routes require auth and admin/superadmin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

router.post(
  "/",
  checkPermission("create_admin_role"),
  adminRoleController.createAdminRole,
);
router.get("/", adminRoleController.getAllAdminRoles);
router.get("/:id", adminRoleController.getAdminRoleById);
router.put(
  "/:id",
  checkPermission("edit_admin_role"),
  adminRoleController.updateAdminRole,
);
router.delete(
  "/:id",
  checkPermission("delete_admin_role"),
  adminRoleController.deleteAdminRole,
);

module.exports = router;
