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
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Configure file upload fields
const uploadFields = upload.fields([
  { name: "digital_signature", maxCount: 1 },
  { name: "profile_photo", maxCount: 1 },
]);

// All trainer management routes require auth
router.use(protect);

// Trainer list/view - Admin & Trainer allowed for course dropdowns
router.get(
  "/",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getAllTrainers,
);
router.get(
  "/export",
  authorize("Admin", "SuperAdmin"),
  checkPermission("export_trainers"),
  exportTrainers,
);
router.get(
  "/dashboard-stats",
  authorize("Admin", "SuperAdmin", "Trainer"),
  getTrainerDashboardStats,
);
router.get(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  getTrainerById,
);

// Trainer CRUD - Admin only with permissions
router.post(
  "/create",
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_trainer"),
  uploadFields,
  createTrainer,
);
router.put(
  "/update/:id",
  authorize("Admin", "SuperAdmin"),
  checkPermission("edit_trainer"),
  uploadFields,
  updateTrainer,
);
router.delete(
  "/delete/:id",
  authorize("Admin", "SuperAdmin"),
  checkPermission("delete_trainer"),
  deleteTrainer,
);

module.exports = router;
