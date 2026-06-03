const express = require("express");
const router = express.Router();
const {
  getAllCandidates,
  getCandidateById,
  getMergePreview,
  mergeCandidates,
  updateCandidate,
  deleteCandidate,
  exportCandidates,
} = require("../controllers/candidateController");
const {
  uploadCandidates,
} = require("../controllers/candidateUploadController");
const {
  importFromApi,
  fetchExternalPreview,
  confirmBulkImport,
  getSyncHistory,
} = require("../controllers/candidateSyncController");
const {
  uploadProfileImage,
} = require("../controllers/candidateProfileUploadController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const candidateUpload = require("../middleware/candidateUploadMiddleware");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.post(
  "/upload-profile-image",
  candidateUpload.single("image"),
  uploadProfileImage,
);

router.use(protect);

router.get("/", authorize("Admin", "SuperAdmin"), getAllCandidates);
router.post(
  "/merge-preview",
  authorize("Admin", "SuperAdmin"),
  checkPermission("edit_candidate"),
  getMergePreview,
);
router.post(
  "/merge",
  authorize("Admin", "SuperAdmin"),
  checkPermission("edit_candidate"),
  mergeCandidates,
);
router.get(
  "/export",
  authorize("Admin", "SuperAdmin"),
  checkPermission("export_candidates"),
  exportCandidates,
);
router.get(
  "/sync-history",
  authorize("Admin", "SuperAdmin"),
  checkPermission("view_candidates"),
  getSyncHistory,
);
router.get("/:id", authorize("Admin", "SuperAdmin"), getCandidateById);
router.put(
  "/update/:id",
  authorize("Admin", "SuperAdmin"),
  checkPermission("edit_candidate"),
  updateCandidate,
);
router.delete(
  "/delete/:id",
  authorize("Admin", "SuperAdmin"),
  checkPermission("delete_candidate"),
  deleteCandidate,
);

router.post(
  "/upload",
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_candidate"),
  upload.single("csv"),
  uploadCandidates,
);
router.post(
  "/import-api",
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_candidate"),
  importFromApi,
);
router.post(
  "/fetch-external-preview",
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_candidate"),
  fetchExternalPreview,
);
router.post(
  "/confirm-bulk-import",
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_candidate"),
  confirmBulkImport,
);

module.exports = router;
