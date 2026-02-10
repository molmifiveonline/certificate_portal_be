const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const verifyToken = require("../middleware/authMiddleware");

// All menu routes require authentication
router.use(verifyToken);

router.get("/", menuController.getSidebarMenu);

module.exports = router;
