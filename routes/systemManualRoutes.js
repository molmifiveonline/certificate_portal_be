const express = require("express");
const router = express.Router();
const systemManualController = require("../controllers/systemManualController");
const uploadSystemManual = require("../middleware/systemManualUploadMiddleware");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All routes require authentication
router.use(protect);

// Routes
router.get("/", checkPermission("view_system_manuals"), systemManualController.getSystemManuals);
router.get("/:id", checkPermission("view_system_manuals"), systemManualController.getSystemManual);
router.post(
  "/",
  checkPermission("manage_system_manuals"),
  uploadSystemManual.single("document_file"),
  systemManualController.addSystemManual,
);
router.put(
  "/:id",
  checkPermission("manage_system_manuals"),
  uploadSystemManual.single("document_file"),
  systemManualController.updateSystemManual,
);
router.delete("/:id", checkPermission("manage_system_manuals"), systemManualController.deleteSystemManual);

module.exports = router;
