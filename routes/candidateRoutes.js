const express = require("express");
const router = express.Router();
const {
  getAllCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  exportCandidates,
} = require("../controllers/candidateController");
const {
  uploadCandidates,
} = require("../controllers/candidateUploadController");
const { importFromApi } = require("../controllers/candidateSyncController");
const {
  uploadProfileImage,
} = require("../controllers/candidateProfileUploadController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const candidateUpload = require("../middleware/candidateUploadMiddleware");
const multer = require("multer");
const path = require("path");

// Multer config for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Protected routes
router.get("/", verifyToken, getAllCandidates);
router.get(
  "/export",
  verifyToken,
  checkPermission("export_candidates"),
  exportCandidates,
);
router.get("/:id", verifyToken, getCandidateById);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission("edit_candidate"),
  updateCandidate,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_candidate"),
  deleteCandidate,
);

// Bulk operations
router.post(
  "/upload",
  verifyToken,
  checkPermission("create_candidate"),
  upload.single("csv"),
  uploadCandidates,
);
router.post(
  "/upload-profile-image",
  candidateUpload.single("image"),
  uploadProfileImage,
);
router.post(
  "/import-api",
  verifyToken,
  checkPermission("create_candidate"),
  importFromApi,
);

module.exports = router;
