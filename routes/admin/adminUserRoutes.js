const express = require("express");
const router = express.Router();
const adminUserController = require("../../controllers/admin/adminUserController");
const authMiddleware = require("../../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", adminUserController.getAdmins);
router.get("/:id", adminUserController.getAdminById);
router.post("/", adminUserController.createAdmin);
router.put("/:id", adminUserController.updateAdmin);
router.delete("/:id", adminUserController.deleteAdmin);

module.exports = router;
