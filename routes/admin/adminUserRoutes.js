const express = require("express");
const router = express.Router();
const adminUserController = require("../../controllers/admin/adminUserController");
const { protect, authorize } = require("../../middleware/authMiddleware");
const checkPermission = require("../../middleware/permissionMiddleware");

// All admin user routes require auth
router.use(protect);

router.get("/", checkPermission("view_admin_users"), adminUserController.getAdmins);
router.get("/:id", checkPermission("view_admin_users"), adminUserController.getAdminById);
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
