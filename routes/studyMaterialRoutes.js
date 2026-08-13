const express = require("express");
const router = express.Router();
const studyMaterialController = require("../controllers/studyMaterialController");
const uploadStudyMaterial = require("../middleware/studyMaterialUploadMiddleware");
const { protect, authorize } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);
// Restrict to Admin roles for managing study materials
router.use(authorize("SuperAdmin", "Admin", "admin"));

// Routes
router.get("/", studyMaterialController.getStudyMaterials);
router.get("/:id", studyMaterialController.getStudyMaterial);
router.post(
  "/",
  uploadStudyMaterial.array("files", 50), // Set high limit for multi-files
  studyMaterialController.addStudyMaterial,
);
router.put(
  "/:id",
  uploadStudyMaterial.array("files", 50),
  studyMaterialController.updateStudyMaterial,
);
router.delete("/:id", studyMaterialController.deleteStudyMaterial);

module.exports = router;
