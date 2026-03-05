const express = require("express");
const router = express.Router();
const masterCourseController = require("../controllers/masterCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

router.post(
  "/",
  protect,
  authorize("Admin", "SuperAdmin"),
  checkPermission("create_master_course"),
  masterCourseController.createMasterCourse,
);
router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  masterCourseController.getAllMasterCourses,
);
router.get(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  masterCourseController.getMasterCourseById,
);
router.put(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  checkPermission("edit_master_course"),
  masterCourseController.updateMasterCourse,
);
router.delete(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  checkPermission("delete_master_course"),
  masterCourseController.deleteMasterCourse,
);

module.exports = router;
