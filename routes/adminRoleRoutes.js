const express = require("express");
const router = express.Router();
const adminRoleController = require("../controllers/adminRoleController");
const authMiddleware = require("../middleware/authMiddleware");

// All admin role routes should be under auth
router.use(authMiddleware);

router.post("/", adminRoleController.createAdminRole);
router.get("/", adminRoleController.getAllAdminRoles);
router.get("/:id", adminRoleController.getAdminRoleById);
router.put("/:id", adminRoleController.updateAdminRole);
router.delete("/:id", adminRoleController.deleteAdminRole);

module.exports = router;
