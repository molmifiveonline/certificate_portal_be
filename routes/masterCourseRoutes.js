const express = require("express");
const router = express.Router();
const masterCourseController = require("../controllers/masterCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

router.post(
  "/",
  protect,
  checkPermission("create_master_course"),
  masterCourseController.createMasterCourse,
);
router.get(
  "/",
  protect,
  checkPermission("view_master_courses", ["Trainer", "Candidate"]),
  masterCourseController.getAllMasterCourses,
);
router.get(
  "/:id",
  protect,
  checkPermission("view_master_courses"),
  masterCourseController.getMasterCourseById,
);
router.put(
  "/:id",
  protect,
  checkPermission("edit_master_course"),
  masterCourseController.updateMasterCourse,
);
router.delete(
  "/:id",
  protect,
  checkPermission("delete_master_course"),
  masterCourseController.deleteMasterCourse,
);

module.exports = router;
