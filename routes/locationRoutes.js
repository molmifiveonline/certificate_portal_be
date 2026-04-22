const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const { protect } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// All location routes require authentication
router.use(protect);

router.get(
  "/",
  checkPermission("view_locations", ["trainer"]),
  locationController.getLocations,
);
router.get(
  "/:id",
  checkPermission("view_locations"),
  locationController.getLocationById,
);
router.post(
  "/",
  checkPermission("manage_locations"),
  locationController.createLocation,
);
router.put(
  "/:id",
  checkPermission("manage_locations"),
  locationController.updateLocation,
);
router.delete(
  "/:id",
  checkPermission("manage_locations"),
  locationController.deleteLocation,
);

module.exports = router;
