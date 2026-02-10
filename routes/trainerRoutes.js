const express = require("express");
const router = express.Router();
const {
  createTrainer,
  getAllTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
  exportTrainers,
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
  checkPermission("create_user"),
  uploadFields,
  createTrainer,
);

router.put(
  "/update/:id",
  verifyToken,
  // checkPermission("update_user"), // Uncomment if permission exists
  uploadFields,
  updateTrainer,
);

router.delete(
  "/delete/:id",
  verifyToken,
  // checkPermission("delete_user"), // Uncomment if permission exists
  deleteTrainer,
);

router.get("/", verifyToken, getAllTrainers);
router.get("/export", verifyToken, exportTrainers); // Place before /:id to avoid conflict
router.get("/:id", verifyToken, getTrainerById);

module.exports = router;
