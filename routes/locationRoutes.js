const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const verifyToken = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All location routes require authentication
router.use(verifyToken);

router.get(
  "/",
  checkPermission("view_location"),
  locationController.getLocations,
);
router.get(
  "/:id",
  checkPermission("view_location"),
  locationController.getLocationById,
);
router.post(
  "/",
  checkPermission("manage_location"),
  locationController.createLocation,
);
router.put(
  "/:id",
  checkPermission("manage_location"),
  locationController.updateLocation,
);
router.delete(
  "/:id",
  checkPermission("manage_location"),
  locationController.deleteLocation,
);

module.exports = router;
