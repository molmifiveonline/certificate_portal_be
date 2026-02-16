const express = require("express");
const router = express.Router();
const masterCourseController = require("../controllers/masterCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("Admin", "SuperAdmin"),
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
  masterCourseController.updateMasterCourse,
);
router.delete(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  masterCourseController.deleteMasterCourse,
);

module.exports = router;
