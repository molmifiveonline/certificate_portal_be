const express = require("express");
const router = express.Router();
const {
  getAllCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  exportCandidates,
} = require("../controllers/candidateController");
const verifyToken = require("../middleware/authMiddleware");

// Protected routes
router.get("/", verifyToken, getAllCandidates);
router.get("/export", verifyToken, exportCandidates);
router.get("/:id", verifyToken, getCandidateById);
router.put("/update/:id", verifyToken, updateCandidate);
router.delete("/delete/:id", verifyToken, deleteCandidate);

module.exports = router;
