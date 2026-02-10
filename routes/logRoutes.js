const express = require("express");
const router = express.Router();
const logController = require("../controllers/logController");
const verifyToken = require("../middleware/authMiddleware");

// Create log - accessible to authenticated users
// Note: Depending on requirements, this might need specific permissions or be open for specific types of logs
router.post("/", verifyToken, logController.createLog);

// Get logs - accessible to authenticated users (likely should be admin only in real app)
router.get("/", verifyToken, logController.getLogs);

// Delete log - accessible to authenticated users
router.delete("/:id", verifyToken, logController.deleteLog);

module.exports = router;
