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
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Configure file upload field
const uploadField = upload.fields([{ name: "hotel_files", maxCount: 10 }]);

// Public/Member routes (assuming view permission is needed)
router.get("/", verifyToken, checkPermission("view_hotel_details"), getHotels);
router.get(
  "/:id",
  verifyToken,
  checkPermission("view_hotel_details"),
  getHotel,
);

// Admin/Management routes
router.post(
  "/",
  verifyToken,
  checkPermission("create_hotel"),
  uploadField,
  addHotel,
);

router.put(
  "/:id",
  verifyToken,
  checkPermission("edit_hotel"),
  uploadField,
  updateHotel,
);

router.delete(
  "/:id",
  verifyToken,
  checkPermission("delete_hotel"),
  deleteHotel,
);

router.delete(
  "/file/:fileId",
  verifyToken,
  checkPermission("edit_hotel"),
  deleteFile,
);

module.exports = router;
