const express = require("express");
const router = express.Router();
const {
  createNominator,
  getAllNominators,
  getNominatorById,
  updateNominator,
  deleteNominator,
} = require("../controllers/nominatorController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// Protected routes (Assuming same protection level as trainers for now)
router.post(
  "/create",
  verifyToken,
  checkPermission("create_nominator"),
  createNominator,
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission("edit_nominator"),
  updateNominator,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("delete_nominator"),
  deleteNominator,
);
router.get("/", verifyToken, getAllNominators);
router.get("/:id", verifyToken, getNominatorById);

module.exports = router;
