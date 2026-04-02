const express = require("express");
const router = express.Router();
const {
  createNominator,
  getAllNominators,
  getNominatorById,
  updateNominator,
  deleteNominator,
} = require("../controllers/nominatorController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All nominator routes require authentication and admin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

// Protected routes
router.post(
  "/create",
  checkPermission("create_nominator"),
  createNominator,
);
router.put(
  "/update/:id",
  checkPermission("edit_nominator"),
  updateNominator,
);
router.delete(
  "/delete/:id",
  checkPermission("delete_nominator"),
  deleteNominator,
);
router.get("/", getAllNominators);
router.get("/:id", getNominatorById);

module.exports = router;
