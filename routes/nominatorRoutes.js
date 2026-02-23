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

// Protected routes (Assuming same protection level as trainers for now)
router.post("/create", verifyToken, createNominator);
router.put("/update/:id", verifyToken, updateNominator);
router.delete("/delete/:id", verifyToken, deleteNominator);
router.get("/", verifyToken, getAllNominators);
router.get("/:id", verifyToken, getNominatorById);

module.exports = router;
