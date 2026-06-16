const express = require("express");
const router = express.Router();
const systemManualCategoryController = require("../controllers/systemManualCategoryController");
const { protect } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All routes require authentication
router.use(protect);

// Routes
router.get("/", checkPermission("view_system_manuals"), systemManualCategoryController.getCategories);
router.get("/:id", checkPermission("view_system_manuals"), systemManualCategoryController.getCategory);
router.post("/", checkPermission("manage_system_manuals"), systemManualCategoryController.createCategory);
router.put("/:id", checkPermission("manage_system_manuals"), systemManualCategoryController.updateCategory);
router.delete("/:id", checkPermission("manage_system_manuals"), systemManualCategoryController.deleteCategory);

module.exports = router;
