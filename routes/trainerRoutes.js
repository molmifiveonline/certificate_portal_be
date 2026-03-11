const express = require("express");
const router = express.Router();
const {
  createTrainer,
  getAllTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
  exportTrainers,
  getTrainerDashboardStats,
} = require("../controllers/trainerController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const upload = require("../middleware/uploadMiddleware"); // Import upload middleware

// Configure file upload fields
const uploadFields = upload.fields([
  { name: "digital_signature", maxCount: 1 },
  { name: "profile_photo", maxCount: 1 },
]);

// Protected routes
router.post(
  "/create",
  verifyToken,
  checkPermission("create_trainer"),
  uploadFields,
  createTrainer,
);

router.put(
  "/update/:id",
  verifyToken,
  checkPermission("edit_trainer"),
  uploadFields,
  updateTrainer,
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_trainer"),
  deleteTrainer,
);

router.get("/", verifyToken, getAllTrainers);
router.get(
  "/export",
  verifyToken,
  checkPermission("export_trainers"),
  exportTrainers,
); // Place before /:id to avoid conflict
router.get("/dashboard-stats", verifyToken, getTrainerDashboardStats);
router.get("/:id", verifyToken, getTrainerById);

module.exports = router;
