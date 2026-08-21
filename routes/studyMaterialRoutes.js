const express = require("express");
const router = express.Router();
const multer = require("multer");
const studyMaterialController = require("../controllers/studyMaterialController");
const uploadStudyMaterial = require("../middleware/studyMaterialUploadMiddleware");
const { protect, authorize } = require("../middleware/authMiddleware");

// Wrapper to catch multer errors and return proper JSON response
const handleUpload = (req, res, next) => {
  uploadStudyMaterial.array("files", 50)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

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
  handleUpload,
  studyMaterialController.addStudyMaterial,
);
router.put(
  "/:id",
  authorize("SuperAdmin", "Admin", "admin"),
  handleUpload,
  studyMaterialController.updateStudyMaterial,
);
router.delete(
  "/:id", 
  authorize("SuperAdmin", "Admin", "admin"), 
  studyMaterialController.deleteStudyMaterial
);

module.exports = router;
