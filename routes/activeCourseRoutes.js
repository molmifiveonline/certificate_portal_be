const express = require("express");
const router = express.Router();
const activeCourseController = require("../controllers/activeCourseController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.createCourse,
);
router.get(
  "/",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer", "Candidate"),
  activeCourseController.getAllCourses,
);
router.get(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.getCourseById,
);
router.put(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin", "Trainer"),
  activeCourseController.updateCourse,
);
router.delete(
  "/:id",
  protect,
  authorize("Admin", "SuperAdmin"),
  activeCourseController.deleteCourse,
);

module.exports = router;
