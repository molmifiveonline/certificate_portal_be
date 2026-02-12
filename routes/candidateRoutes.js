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
router.get("/export", verifyToken, exportCandidates);
router.get("/:id", verifyToken, getCandidateById);
router.put("/update/:id", verifyToken, updateCandidate);
router.delete("/delete/:id", verifyToken, deleteCandidate);

// Bulk operations
router.post("/upload", verifyToken, upload.single("csv"), uploadCandidates);
router.post(
  "/upload-profile-image",
  candidateUpload.single("image"),
  uploadProfileImage,
);
router.post("/import-api", verifyToken, importFromApi);

module.exports = router;
