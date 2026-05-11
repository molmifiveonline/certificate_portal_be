const express = require("express");
const router = express.Router();
const {
  getHotels,
  getHotel,
  addHotel,
  updateHotel,
  deleteHotel,
  deleteFile,
} = require("../controllers/hotelDetailController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Configure file upload field
const uploadField = upload.fields([{ name: "hotel_files", maxCount: 10 }]);

// All hotel routes require authentication and admin/superadmin role
router.use(protect);
router.use(authorize("Admin", "SuperAdmin"));

// View routes
router.get("/", checkPermission(["view_hotels", "view_hotel_details"]), getHotels);
router.get(
  "/:id",
  checkPermission(["view_hotels", "view_hotel_details"]),
  getHotel,
);

// Admin/Management routes
router.post(
  "/",
  checkPermission("create_hotel"),
  uploadField,
  addHotel,
);

router.put(
  "/:id",
  checkPermission("edit_hotel"),
  uploadField,
  updateHotel,
);

router.delete(
  "/:id",
  checkPermission("delete_hotel"),
  deleteHotel,
);

router.delete(
  "/file/:fileId",
  checkPermission("edit_hotel"),
  deleteFile,
);

module.exports = router;
