const express = require("express");
const router = express.Router();
const adminUserController = require("../../controllers/admin/adminUserController");
const { protect, authorize } = require("../../middleware/authMiddleware");
const checkPermission = require("../../middleware/permissionMiddleware");

// All admin user routes require auth and admin/superadmin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

router.get("/", adminUserController.getAdmins);
router.get("/:id", adminUserController.getAdminById);
router.post(
  "/",
  checkPermission("create_admin_user"),
  adminUserController.createAdmin,
);
router.put(
  "/:id",
  checkPermission("edit_admin_user"),
  adminUserController.updateAdmin,
);
router.delete(
  "/:id",
  checkPermission("delete_admin_user"),
  adminUserController.deleteAdmin,
);

module.exports = router;
