const express = require("express");
const router = express.Router();
const studyMaterialController = require("../controllers/studyMaterialController");
const uploadStudyMaterial = require("../middleware/studyMaterialUploadMiddleware");
const { protect, authorize } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);
// Routes
router.get(
  "/", 
  authorize("SuperAdmin", "Admin", "admin", "Trainer", "Candidate"), 
  studyMaterialController.getStudyMaterials
);
router.get(
  "/:id", 
  authorize("SuperAdmin", "Admin", "admin", "Trainer", "Candidate"), 
  studyMaterialController.getStudyMaterial
);
router.post(
  "/",
  authorize("SuperAdmin", "Admin", "admin"),
  uploadStudyMaterial.array("files", 50), // Set high limit for multi-files
  studyMaterialController.addStudyMaterial,
);
router.put(
  "/:id",
  authorize("SuperAdmin", "Admin", "admin"),
  uploadStudyMaterial.array("files", 50),
  studyMaterialController.updateStudyMaterial,
);
router.delete(
  "/:id", 
  authorize("SuperAdmin", "Admin", "admin"), 
  studyMaterialController.deleteStudyMaterial
);

module.exports = router;
