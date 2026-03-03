const express = require("express");
const router = express.Router();
const adminRoleController = require("../controllers/adminRoleController");
const authMiddleware = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All admin role routes should be under auth
router.use(authMiddleware);

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
